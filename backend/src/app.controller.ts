import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators.js';
import { AppService } from './app.service.js';
import { APP_ROUTES } from './routes/index.js';

@Controller(APP_ROUTES.BASE)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get(APP_ROUTES.HEALTH)
  getHello(): string {
    return this.appService.getHello();
  }
}
