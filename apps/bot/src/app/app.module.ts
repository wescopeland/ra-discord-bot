import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DiscordBotManagerService } from './discord-bot-manager.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, DiscordBotManagerService],
})
export class AppModule {}
