import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { IsObjectIdPipe } from '@nestjs/mongoose';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { SearchQuery } from '../common/query.js';
import { CategoryInput } from './categories.dto.js';
import { CategoriesService } from './categories.service.js';
import { CATEGORIES_ROUTES } from '../routes/index.js';

@Controller(CATEGORIES_ROUTES.BASE)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get(CATEGORIES_ROUTES.LIST)
  list(@CurrentUser() user: AuthUser, @Query() query: SearchQuery) {
    return this.categories.list(user, query.q);
  }

  @Get(CATEGORIES_ROUTES.DETAIL)
  findOne(@Param('id', IsObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.categories.findAccessible(id, user);
  }

  @Get(CATEGORIES_ROUTES.MEMBERS)
  members(@Param('id', IsObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.categories.members(id, user);
  }

  @Post(CATEGORIES_ROUTES.CREATE)
  @Roles('admin')
  create(@Body() dto: CategoryInput, @CurrentUser() user: AuthUser) {
    return this.categories.create(dto, user);
  }

  @Put(CATEGORIES_ROUTES.UPDATE)
  @Roles('admin')
  update(@Param('id', IsObjectIdPipe) id: string, @Body() dto: CategoryInput, @CurrentUser() user: AuthUser) {
    return this.categories.update(id, dto, user);
  }

  @Delete(CATEGORIES_ROUTES.DELETE)
  @Roles('admin')
  @HttpCode(204)
  remove(@Param('id', IsObjectIdPipe) id: string) {
    return this.categories.remove(id);
  }
}
