import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  heartbeat() {
    return { foo: 'bar' };
  }

  @Get('health')
  health() {
    return { foo: 'bar' };
  }
}
