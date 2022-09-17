import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  Achievement,
  DatedAchievement,
  GameInfoAndUserProgress,
  RetroAchievementsClient,
} from 'retroachievements-js';
import { createClient as createRedisClient, RedisClientType } from 'redis';
import pLimit from 'p-limit';

import { leagueMembers } from './league-members';

const raClient = new RetroAchievementsClient({
  userName: 'WCopeland', // this is your actual account name on the site
  apiKey: process.env['RA_API_KEY'],
});

@Injectable()
export class RetroAchievementsService implements OnModuleInit {
  #logger = new Logger(RetroAchievementsService.name);
  #redis: RedisClientType<any>;

  async onModuleInit() {
    this.#redis = createRedisClient({ url: process.env['REDIS_URL'] ?? '' });
    this.#redis.on('error', (err) => console.log('Redis Client Error', err));
    await this.#redis.connect();
  }

  async fetchUserAchievementsBetweenDates(
    userName: string,
    fromDate: Date,
    toDate: Date
  ) {
    const userDatedAchievements =
      await raClient.getUserAchievementsEarnedBetweenDates(
        userName,
        new Date(fromDate),
        new Date(toDate)
      );

    const hardcoreOnly = userDatedAchievements.filter(
      (achievement) => achievement.hardcoreMode === 1
    );

    return hardcoreOnly;
  }

  async fetchUserGameProgressFromDatedAchievements(
    userName: string,
    datedAchievements: DatedAchievement[]
  ) {
    const gameIdsToRetrieve: number[] = [];

    // Fetch all the games in the list.
    for (const achievement of datedAchievements) {
      if (!gameIdsToRetrieve.includes(achievement.gameId)) {
        gameIdsToRetrieve.push(achievement.gameId);
      }
    }

    const gameFetchPromises: Promise<GameInfoAndUserProgress>[] = [];
    const limit = pLimit(10);
    for (const gameId of gameIdsToRetrieve) {
      gameFetchPromises.push(
        limit(() => raClient.getUserProgressForGameId(userName, gameId))
      );
    }

    const userGameProgressEntities = await Promise.all(gameFetchPromises);

    return userGameProgressEntities;
  }

  async checkForNewMastery(username: string) {
    this.#logger.log(`Checking for new mastery for ${username}.`);

    const rawUserMasteryGameIds = await this.#redis.get(
      `masteries_${username}`
    );
    const userMasteryGameIds = JSON.parse(
      rawUserMasteryGameIds ?? '[]'
    ) as number[];

    const gameCompletionStats = await raClient.getUserGameCompletionStats(
      username
    );
    const onlyMasteredGames = gameCompletionStats.filter(
      (stat) => stat.hardcoreMode === 1 && stat.pctWon === 1
    );

    if (!onlyMasteredGames.length || onlyMasteredGames.length === 0) {
      return null;
    }

    for (const game of onlyMasteredGames) {
      // Do we already have a recorded mastery for this game?
      const alreadyHasRecordedMastery = userMasteryGameIds.includes(
        game.gameId
      );

      if (!alreadyHasRecordedMastery) {
        this.#logger.log(
          `Found a new mastery for ${username}: (${game.gameId}) ${game.title} [${game.consoleName}].`
        );

        this.#logger.log(
          `Recording ${username}'s mastery for ${game.gameId} and returning the game.`
        );
        userMasteryGameIds.push(game.gameId);
        await this.#redis.set(
          `masteries_${username}`,
          JSON.stringify(userMasteryGameIds)
        );

        // We need to compute the number of points in the game.
        const gameStats = await raClient.getExtendedGameInfoByGameId(
          game.gameId
        );
        let totalGamePoints = 0;
        for (const achievement of gameStats.achievements) {
          totalGamePoints += achievement.points;
        }

        // We need to find the rarest achievement for the game.
        let rarestAchievement: Achievement | null = null;
        for (const achievement of gameStats.achievements) {
          if (!rarestAchievement) {
            rarestAchievement = achievement;
            continue;
          }

          if (
            (achievement.trueRatio ?? 0) > (rarestAchievement.trueRatio ?? 0)
          ) {
            rarestAchievement = achievement;
          }
        }

        return {
          game,
          totalGamePoints,
          rarestAchievement,
          totalMasteryCount: userMasteryGameIds.length,
        };
      }
    }

    return null;
  }

  async setupAllNewUsers() {
    // Avoid a race condition where Redis may not be connected yet.
    await this.onModuleInit();

    this.#logger.log('Checking for new users.');

    for (const leagueMember of leagueMembers) {
      const foundMasteriesRecord = await this.#redis.get(
        `masteries_${leagueMember.raUsername}`
      );

      if (!foundMasteriesRecord) {
        this.#logger.log(`Detected a new user: ${leagueMember.raUsername}.`);
        await this.setupNewUser(leagueMember.raUsername);
      }
    }
  }

  private async setupNewUser(username: string) {
    this.#logger.log(`Setting up new user: ${username}.`);

    // Store all of their current mastery game IDs.
    const userMasteryGameIds = await this.getAllUserGameMasteryIds(username);
    await this.#redis.set(
      `masteries_${username}`,
      JSON.stringify(userMasteryGameIds)
    );
    this.#logger.log(
      `Stored ${userMasteryGameIds.length} masteries for user ${username}.`
    );
  }

  private async getAllUserGameMasteryIds(username: string) {
    const gameCompletionStats = await raClient.getUserGameCompletionStats(
      username
    );
    const onlyMasteredGames = gameCompletionStats.filter(
      (stat) => stat.hardcoreMode === 1 && stat.pctWon === 1
    );

    return onlyMasteredGames.map((game) => game.gameId);
  }
}
