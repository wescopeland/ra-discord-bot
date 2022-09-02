import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RetroAchievementsClient } from 'retroachievements-js';
import { createClient as createRedisClient, RedisClientType } from 'redis';

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

        return { game, totalMasteryCount: userMasteryGameIds.length };
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
