import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../auth/auth.types.js';
import { summaryAccumulators, toSummaryDto, type SummaryRow } from '../common/expense-summary.js';
import { fromCents, toCents } from '../common/money.js';
import { containsRegex } from '../common/query.js';
import { Expense } from '../expenses/expense.schema.js';
import { deleteUnusedReceiptFiles } from '../uploads/receipt-files.js';
import { UsersService } from '../users/users.service.js';
import type { CategoryInput } from './categories.dto.js';
import { Category } from './category.schema.js';

interface UserRef {
  _id: Types.ObjectId;
  name: string;
  email: string;
}

type PopulatedCategory = Omit<Category, 'assignedUsers'> & {
  _id: Types.ObjectId;
  assignedUsers: UserRef[];
};

export const usersMayAddExpenses = () => process.env.ALLOW_USER_EXPENSES !== 'false';

@Injectable()
export class CategoriesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectModel(Category.name) private readonly categories: Model<Category>,
    @InjectModel(Expense.name) private readonly expenses: Model<Expense>,
    private readonly users: UsersService,
  ) {}

  /** Upgrades documents written by earlier versions of the schema. */
  async onApplicationBootstrap() {
    const categories = await this.categories.collection.updateMany(
      { assignedTo: { $exists: true } },
      [
        {
          $set: {
            assignedUsers: { $cond: [{ $ifNull: ['$assignedTo', false] }, ['$assignedTo'], []] },
          },
        },
        { $unset: 'assignedTo' },
      ],
    );
    const expenses = await this.expenses.collection.updateMany({ paidBy: { $exists: false } }, [
      { $set: { paidBy: '$addedBy' } },
    ]);
    if (categories.modifiedCount || expenses.modifiedCount) {
      this.logger.log(
        `Migrated ${categories.modifiedCount} categories and ${expenses.modifiedCount} expenses to the new schema`,
      );
    }
  }

  /** RBAC: admins see every category, users only those assigned to them. */
  accessFilter(user: AuthUser) {
    return user.role === 'admin' ? {} : { assignedUsers: new Types.ObjectId(user.id) };
  }

  async accessibleIds(user: AuthUser) {
    return this.categories.find(this.accessFilter(user)).distinct<'_id', Types.ObjectId>('_id').exec();
  }

  async list(user: AuthUser, q?: string) {
    const regex = containsRegex(q);
    const filter = { ...this.accessFilter(user), ...(regex && { $or: [{ name: regex }, { description: regex }] }) };
    const rows = await this.categories
      .find(filter)
      .populate<{ assignedUsers: UserRef[] }>('assignedUsers', 'name email')
      .collation({ locale: 'en' })
      .sort({ name: 1 })
      .lean<PopulatedCategory[]>()
      .exec();

    const summaries = await this.summariesFor(rows.map((r) => r._id));
    return rows.map((row) => this.toDto(row, summaries.get(row._id.toString()), user));
  }

  /** Non-owners get 404 rather than 403 so other users' categories aren't revealed. */
  async findAccessible(id: string, user: AuthUser) {
    const row = Types.ObjectId.isValid(id)
      ? await this.categories
          .findOne({ _id: id, ...this.accessFilter(user) })
          .populate<{ assignedUsers: UserRef[] }>('assignedUsers', 'name email')
          .lean<PopulatedCategory>()
          .exec()
      : null;
    if (!row) throw new NotFoundException('Category not found');
    const summaries = await this.summariesFor([row._id]);
    return this.toDto(row, summaries.get(row._id.toString()), user);
  }

  /** Assigned users with how much each has paid in this category. */
  async members(id: string, user: AuthUser) {
    const category = await this.findAccessible(id, user);
    const spend = await this.expenses.aggregate<{ _id: Types.ObjectId; totalCents: number; count: number }>([
      { $match: { category: new Types.ObjectId(id) } },
      { $group: { _id: '$paidBy', totalCents: { $sum: '$amountCents' }, count: { $sum: 1 } } },
    ]);
    const byUser = new Map(spend.map((s) => [s._id.toString(), s]));
    return category.assignedUsers.map((u) => ({
      ...u,
      totalSpent: fromCents(byUser.get(u.id)?.totalCents ?? 0),
      expenseCount: byUser.get(u.id)?.count ?? 0,
    }));
  }

  async create(input: CategoryInput, admin: AuthUser) {
    await this.users.assertAllExist(input.assignedUserIds ?? []);
    const created = await this.categories.create({
      ...this.toFields(input),
      createdBy: new Types.ObjectId(admin.id),
    });
    return this.findAccessible(created.id as string, admin);
  }

  async update(id: string, input: CategoryInput, admin: AuthUser) {
    await this.findAccessible(id, admin);
    await this.users.assertAllExist(input.assignedUserIds ?? []);
    await this.categories.updateOne({ _id: id }, this.toFields(input));
    return this.findAccessible(id, admin);
  }

  async remove(id: string) {
    const { deletedCount } = await this.categories.deleteOne({ _id: id });
    if (!deletedCount) throw new NotFoundException('Category not found');
    const receipts = await this.expenses.find({ category: id, receiptUrl: { $ne: null } }).distinct<'receiptUrl', string>('receiptUrl');
    await this.expenses.deleteMany({ category: id });
    await deleteUnusedReceiptFiles(this.expenses, receipts);
  }

  async summariesFor(categoryIds: Types.ObjectId[]) {
    const rows = await this.expenses.aggregate<{ _id: Types.ObjectId } & SummaryRow>([
      { $match: { category: { $in: categoryIds } } },
      { $group: { _id: '$category', ...summaryAccumulators() } },
    ]);
    return new Map(rows.map((r) => [r._id.toString(), r]));
  }

  private toFields(input: CategoryInput) {
    return {
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      icon: input.icon ?? null,
      color: input.color ?? null,
      budgetLimitCents: input.budgetLimit == null ? null : toCents(input.budgetLimit),
      status: input.status ?? 'active',
      ...(input.assignedUserIds && { assignedUsers: input.assignedUserIds.map((u) => new Types.ObjectId(u)) }),
    };
  }

  private toDto(row: PopulatedCategory, summary: SummaryRow | undefined, user: AuthUser) {
    const status = row.status ?? 'active';
    return {
      id: row._id.toString(),
      name: row.name,
      description: row.description ?? '',
      icon: row.icon,
      color: row.color ?? null,
      budgetLimit: row.budgetLimitCents == null ? null : fromCents(row.budgetLimitCents),
      status,
      createdBy: row.createdBy.toString(),
      assignedUsers: (row.assignedUsers ?? [])
        .filter(Boolean)
        .map((u) => ({ id: u._id.toString(), name: u.name, email: u.email })),
      ...toSummaryDto(summary),
      canAddExpense: user.role === 'admin' || (usersMayAddExpenses() && status === 'active'),
    };
  }
}
