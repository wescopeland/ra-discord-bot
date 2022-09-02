import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DiscordBotManagerService } from './discord-bot-manager.service';
import { RetroAchievementsService } from './retro-achievements.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, DiscordBotManagerService, RetroAchievementsService],
})
export class AppModule {}
