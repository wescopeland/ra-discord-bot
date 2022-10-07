import { Injectable, Logger } from '@nestjs/common';
import {
  Client as DiscordClient,
  GatewayIntentBits,
  TextChannel,
} from 'discord.js';
import { toWordsOrdinal } from 'number-to-words';

import { RetroAchievementsService } from './retro-achievements.service';

import { LeagueService } from './league.service';
import { leagueMembers } from './league-members';

const THREE_MINUTES = 3 * 60 * 1000;

@Injectable()
export class DiscordBotManagerService {
  #logger = new Logger(DiscordBotManagerService.name);

  constructor(
    private readonly leagueService: LeagueService,
    private readonly retroAchievementsService: RetroAchievementsService
  ) {}

  async initializeBot() {
    this.#logger.log('Initializing Discord bot.');

    await this.retroAchievementsService.setupAllNewUsers();

    const newDiscordClient = new DiscordClient({
      intents: [GatewayIntentBits.Guilds],
    });

    newDiscordClient.on('ready', (client) => {
      this.#logger.log('Bot is ready.');

      setInterval(async () => {
        await this.beginNewMasteriesRoutine(client);
      }, THREE_MINUTES);
    });

    newDiscordClient.on('messageCreate', async (message) => {
      if (message.content.startsWith('!ping')) {
        message.reply('Pong');
      }
    });

    newDiscordClient.login(process.env['BOT_TOKEN'] ?? '');
  }

  private async beginNewMasteriesRoutine(discordClient: DiscordClient<true>) {
    this.#logger.log('Checking for new masteries.');

    for (const leagueMember of leagueMembers) {
      const newMastery = await this.retroAchievementsService.checkForNewMastery(
        leagueMember.raUsername
      );

      if (newMastery) {
        const { rarestAchievement, totalGamePoints, game, totalMasteryCount } =
          newMastery;

        (
          discordClient.channels.cache.get(
            process.env['CHANNEL_ID']
          ) as TextChannel
        ).send(
          `<@${leagueMember.discordId}> has just earned their ${toWordsOrdinal(
            totalMasteryCount
          )} mastery: ${game.title} (${
            game.consoleName
          }) for ${totalGamePoints} points! The hardest achievement for this game is "${
            rarestAchievement.title
          }" - ${rarestAchievement.description}, worth ${
            rarestAchievement.points
          } points. https://retroachievements.org/game/${game.gameId}`
        );
      }
    }

    this.#logger.log('Finished checking for new masteries.');
  }
}
