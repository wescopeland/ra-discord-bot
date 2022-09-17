import { Injectable } from '@nestjs/common';
import {
  DatedAchievement,
  Achievement,
  GameInfoAndUserProgress,
} from 'retroachievements-js';
import type { LeagueMember } from './league-members';
import dayjs from 'dayjs';

import { RetroAchievementsService } from './retro-achievements.service';

@Injectable()
export class LeagueService {
  constructor(
    private readonly retroAchievementsService: RetroAchievementsService
  ) {}

  async buildLeagueMemberMonthlyStats(leagueMember: LeagueMember) {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const datedAchievements =
      await this.retroAchievementsService.fetchUserAchievementsBetweenDates(
        leagueMember.raUsername,
        firstDay,
        lastDay
      );

    const totalPoints =
      this.#getTotalPointsFromDatedAchievements(datedAchievements);

    const monthlyUserGames =
      await this.retroAchievementsService.fetchUserGameProgressFromDatedAchievements(
        leagueMember.raUsername,
        datedAchievements
      );

    const onlyWithMonthlyAchievements = this.#filterMonthlyGamesAchievements(
      monthlyUserGames,
      datedAchievements
    );

    const { rarestAchievement, rarestAchievementGame } =
      this.#getRarestAchievementFromUserGames(onlyWithMonthlyAchievements);

    const totalUserWhitePoints = this.#getTotalWhitePointsFromUserGames(
      onlyWithMonthlyAchievements
    );

    return {
      leagueMember,
      totalPoints,
      rarestAchievement,
      rarestAchievementGame,
      totalUserWhitePoints,
    };
  }

  /**
   * We are only interested in the achievements that were earned during
   * the current monthly time period that we're evaluating.
   */
  #filterMonthlyGamesAchievements(
    userGames: GameInfoAndUserProgress[],
    datedAchievements: DatedAchievement[]
  ) {
    const validAchievementIds = datedAchievements.map(
      (achievement) => achievement.achievementId
    );

    for (const game of userGames) {
      game.achievements = game.achievements.filter((achievement) =>
        validAchievementIds.includes(achievement.id)
      );
    }

    return userGames;
  }

  #getRarestAchievementFromUserGames(userGames: GameInfoAndUserProgress[]) {
    let rarestAchievement: Achievement | null = null;
    let forGame: GameInfoAndUserProgress | null = null;

    for (const game of userGames) {
      const onlyEarnedAchievements = game.achievements.filter(
        (achievement) => !!achievement.dateEarnedHardcore
      );

      // This rules out ninja revisions causing an achievement
      // to spike in white points.
      const onlyMaturedAchievements = onlyEarnedAchievements.filter(
        (achievement) => {
          const now = dayjs();
          const createdAt = dayjs(achievement.dateCreated);
          const weeksSince = now.diff(createdAt, 'weeks');

          return weeksSince >= 2;
        }
      );

      for (const achievement of onlyMaturedAchievements) {
        if (!rarestAchievement) {
          rarestAchievement = achievement;
          forGame = game;

          continue;
        }

        if (achievement.trueRatio > rarestAchievement.trueRatio) {
          rarestAchievement = achievement;
          forGame = game;
        }
      }
    }

    return { rarestAchievement, rarestAchievementGame: forGame };
  }

  #getTotalWhitePointsFromUserGames(userGames: GameInfoAndUserProgress[]) {
    let totalWhitePoints = 0;

    for (const game of userGames) {
      const onlyEarnedAchievements = game.achievements.filter(
        (achievement) => !!achievement.dateEarnedHardcore
      );

      // This rules out ninja revisions causing an achievement
      // to spike in white points.
      const onlyMaturedAchievements = onlyEarnedAchievements.filter(
        (achievement) => {
          const now = dayjs();
          const createdAt = dayjs(achievement.dateCreated);
          const weeksSince = now.diff(createdAt, 'weeks');

          return weeksSince >= 2;
        }
      );

      for (const achievement of onlyMaturedAchievements) {
        totalWhitePoints += achievement.trueRatio;
      }
    }

    return totalWhitePoints;
  }

  #getTotalPointsFromDatedAchievements(datedAchievements: DatedAchievement[]) {
    let total = 0;

    for (const achievement of datedAchievements) {
      total += achievement.points;
    }

    return total;
  }
}
