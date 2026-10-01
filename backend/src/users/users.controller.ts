import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { IsObjectIdPipe } from '@nestjs/mongoose';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { SearchQuery } from '../common/query.js';
import { CreateUserDto, UpdateUserDto } from './users.dto.js';
import { UsersService } from './users.service.js';
import { USERS_ROUTES } from '../routes/index.js';

@Controller(USERS_ROUTES.BASE)
@Roles('admin')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(USERS_ROUTES.LIST)
  list(@Query() query: SearchQuery) {
    return this.users.list(query.q);
  }

  @Post(USERS_ROUTES.CREATE)
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Put(USERS_ROUTES.UPDATE)
  update(@Param('id', IsObjectIdPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() me: AuthUser) {
    return this.users.update(id, dto, me.id);
  }

  @Delete(USERS_ROUTES.DELETE)
  @HttpCode(204)
  remove(@Param('id', IsObjectIdPipe) id: string, @CurrentUser() me: AuthUser) {
    return this.users.remove(id, me.id);
  }
}
