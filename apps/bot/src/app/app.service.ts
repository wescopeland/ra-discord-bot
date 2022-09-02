import { Injectable, OnModuleInit } from '@nestjs/common';

import { DiscordBotManagerService } from './discord-bot-manager.service';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(private readonly botManagerService: DiscordBotManagerService) {}

  async onModuleInit() {
    this.botManagerService.initializeBot();
  }
}
