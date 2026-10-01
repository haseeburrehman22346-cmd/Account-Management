import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { DashboardService } from './dashboard.service.js';
import { DASHBOARD_ROUTES } from '../routes/index.js';

class OverviewQuery {
  @IsOptional()
  @Type(() => Number)
  @IsIn([3, 6, 12])
  months: number = 6;
}

@Controller(DASHBOARD_ROUTES.BASE)
@Roles('admin')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get(DASHBOARD_ROUTES.OVERVIEW)
  overview(@CurrentUser() user: AuthUser, @Query() query: OverviewQuery) {
    return this.dashboard.overview(user, query.months);
  }
}
