import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { IsObjectIdPipe } from '@nestjs/mongoose';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { PageQuery } from '../common/query.js';
import { ExpenseInput, ExpenseQuery } from './expenses.dto.js';
import { ExpensesService } from './expenses.service.js';
import { EXPENSES_ROUTES } from '../routes/index.js';

@Controller(EXPENSES_ROUTES.BASE)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get(EXPENSES_ROUTES.SEARCH)
  search(@Query() query: ExpenseQuery, @CurrentUser() user: AuthUser) {
    return this.expenses.search(user, query);
  }

  @Get(EXPENSES_ROUTES.LIST_BY_CATEGORY)
  listForCategory(
    @Param('id', IsObjectIdPipe) categoryId: string,
    @Query() query: PageQuery,
    @CurrentUser() user: AuthUser,
  ) {
    return this.expenses.search(user, { q: query.q, page: query.page, limit: query.limit, categoryId });
  }

  @Post(EXPENSES_ROUTES.CREATE_IN_CATEGORY)
  create(@Param('id', IsObjectIdPipe) categoryId: string, @Body() dto: ExpenseInput, @CurrentUser() user: AuthUser) {
    return this.expenses.create(categoryId, dto, user);
  }

  @Put(EXPENSES_ROUTES.UPDATE)
  update(@Param('id', IsObjectIdPipe) id: string, @Body() dto: ExpenseInput, @CurrentUser() user: AuthUser) {
    return this.expenses.update(id, dto, user);
  }

  @Delete(EXPENSES_ROUTES.DELETE)
  @HttpCode(204)
  remove(@Param('id', IsObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.expenses.remove(id, user);
  }
}
