import { Injectable, Logger } from '@nestjs/common';
import {
  Client as DiscordClient,
  GatewayIntentBits,
  TextChannel,
} from 'discord.js';
import { RetroAchievementsClient } from 'retroachievements-js';

const raClient = new RetroAchievementsClient({
  userName: 'WCopeland', // this is your actual account name on the site
  apiKey: process.env['RA_API_KEY'],
});

const FIVE_MINUTES = 5 * 60 * 1000;

@Injectable()
export class DiscordBotManagerService {
  #logger = new Logger(DiscordBotManagerService.name);

  async initializeBot() {
    this.#logger.log('Initializing Discord bot.');

    const newDiscordClient = new DiscordClient({
      intents: [GatewayIntentBits.Guilds],
    });

    newDiscordClient.on('ready', async (client) => {
      console.log('bot ready');

      // (client.channels.cache.get('621641494633381888') as TextChannel).send(
      //   `01010101 BOT iniTIALIZED KILL ALL HUMANS nah jk`
      // );

      const completionProgress = await raClient.getUserRecentlyPlayedGames(
        'Barra',
        3
      );
      console.log(completionProgress);
    });

    newDiscordClient.login(process.env['BOT_TOKEN'] ?? '');
  }
}
