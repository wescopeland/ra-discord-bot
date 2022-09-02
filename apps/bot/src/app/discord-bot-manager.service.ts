import { Injectable, Logger } from '@nestjs/common';
import {
  Client as DiscordClient,
  GatewayIntentBits,
  TextChannel,
} from 'discord.js';
import { toWordsOrdinal } from 'number-to-words';

import { RetroAchievementsService } from './retro-achievements.service';

import { leagueMembers } from './league-members';

const THREE_MINUTES = 3 * 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;

@Injectable()
export class DiscordBotManagerService {
  #logger = new Logger(DiscordBotManagerService.name);

  constructor(
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

    newDiscordClient.login(process.env['BOT_TOKEN'] ?? '');
  }

  private async beginNewMasteriesRoutine(discordClient: DiscordClient<true>) {
    this.#logger.log('Checking for new masteries.');

    for (const leagueMember of leagueMembers) {
      const newMastery = await this.retroAchievementsService.checkForNewMastery(
        leagueMember.raUsername
      );

      if (newMastery) {
        (
          discordClient.channels.cache.get(
            process.env['CHANNEL_ID']
          ) as TextChannel
        ).send(
          `<@${leagueMember.discordId}> has just earned their ${toWordsOrdinal(
            newMastery.totalMasteryCount
          )} mastery: ${newMastery.game.title} (${
            newMastery.game.consoleName
          }) for ${
            newMastery.game.maxPossible
          } points! https://retroachievements.org/game/${
            newMastery.game.gameId
          }`
        );
      }
    }
  }
}
