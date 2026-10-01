import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../auth/auth.types.js';
import { Category } from '../categories/category.schema.js';
import { lastMonths } from '../common/dates.js';
import { summaryAccumulators, toSummaryDto, type SummaryRow } from '../common/expense-summary.js';
import { fromCents } from '../common/money.js';
import { Expense } from '../expenses/expense.schema.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { User } from '../users/user.schema.js';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Expense.name) private readonly expenses: Model<Expense>,
    @InjectModel(Category.name) private readonly categories: Model<Category>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly expensesService: ExpensesService,
  ) {}

  async overview(admin: AuthUser, months: number) {
    const monthKeys = lastMonths(months);

    const [summary, monthlyRows, byCategoryRows, categories, totalUsers, standardUsers, recent] = await Promise.all([
      this.expenses.aggregate<SummaryRow>([{ $group: { _id: null, ...summaryAccumulators() } }]),
      this.expenses.aggregate<{ _id: string; totalCents: number }>([
        { $match: { date: { $gte: `${monthKeys[0]}-01` } } },
        { $group: { _id: { $substrBytes: ['$date', 0, 7] }, totalCents: { $sum: '$amountCents' } } },
      ]),
      this.expenses.aggregate<{ _id: Types.ObjectId; totalCents: number }>([
        { $group: { _id: '$category', totalCents: { $sum: '$amountCents' } } },
        { $sort: { totalCents: -1 } },
      ]),
      this.categories
        .find({}, { name: 1, icon: 1, color: 1, status: 1, assignedUsers: 1 })
        .lean<(Category & { _id: Types.ObjectId })[]>()
        .exec(),
      this.users.countDocuments(),
      this.users.countDocuments({ role: 'user' }),
      this.expensesService.search(admin, { page: 1, limit: 5 }),
    ]);

    const totals = toSummaryDto(summary[0]);
    const monthly = new Map(monthlyRows.map((r) => [r._id, r.totalCents]));
    const categoryById = new Map(categories.map((c) => [c._id.toString(), c]));
    const grandTotal = byCategoryRows.reduce((sum, r) => sum + r.totalCents, 0);
    const assignedUsers = new Set(categories.flatMap((c) => (c.assignedUsers ?? []).map((u) => u.toString())));

    return {
      stats: {
        totalSpent: totals.totalSpent,
        totalGrowthPct: totals.totalGrowthPct,
        thisMonthSpent: totals.thisMonthSpent,
        thisMonthGrowthPct: totals.thisMonthGrowthPct,
        activeCategories: categories.filter((c) => (c.status ?? 'active') === 'active').length,
        totalCategories: categories.length,
        assignedUsers: assignedUsers.size,
        totalUsers,
        standardUsers,
      },
      monthly: monthKeys.map((month) => ({ month, total: fromCents(monthly.get(month) ?? 0) })),
      byCategory: byCategoryRows
        .filter((r) => categoryById.has(r._id.toString()))
        .map((r) => {
          const c = categoryById.get(r._id.toString())!;
          return {
            id: r._id.toString(),
            name: c.name,
            icon: c.icon,
            color: c.color ?? null,
            total: fromCents(r.totalCents),
            percent: grandTotal ? Math.round((r.totalCents / grandTotal) * 1000) / 10 : 0,
          };
        }),
      recent: recent.items,
    };
  }
}
