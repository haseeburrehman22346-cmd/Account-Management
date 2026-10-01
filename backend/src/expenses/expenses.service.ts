import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import type { AuthUser } from '../auth/auth.types.js';
import { CategoriesService, usersMayAddExpenses } from '../categories/categories.service.js';
import { fromCents, toCents } from '../common/money.js';
import { containsRegex, type Paginated } from '../common/query.js';
import { deleteUnusedReceiptFiles } from '../uploads/receipt-files.js';
import { UsersService } from '../users/users.service.js';
import type { ExpenseInput, ExpenseQuery } from './expenses.dto.js';
import { Expense } from './expense.schema.js';

interface Ref {
  _id: Types.ObjectId;
  name: string;
}

type PopulatedExpense = Omit<Expense, 'category' | 'paidBy' | 'addedBy'> & {
  _id: Types.ObjectId;
  category: Ref & { icon: string | null; color: string | null };
  paidBy: Ref | null;
  addedBy: Ref | null;
};

export type ExpenseDto = ReturnType<typeof toDto>;

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name) private readonly expenses: Model<Expense>,
    private readonly categories: CategoriesService,
    private readonly users: UsersService,
  ) {}

  /** Paginated search across every category the user may see (or one, via categoryId). */
  async search(user: AuthUser, query: ExpenseQuery): Promise<Paginated<ExpenseDto>> {
    const categoryIds = query.categoryId
      ? [new Types.ObjectId((await this.categories.findAccessible(query.categoryId, user)).id)]
      : await this.categories.accessibleIds(user);

    const filter: QueryFilter<Expense> = { category: { $in: categoryIds } };
    const regex = containsRegex(query.q);
    if (regex) {
      const or: QueryFilter<Expense>[] = [{ title: regex }, { note: regex }];
      const amount = Number(query.q!.replace(/,/g, ''));
      if (Number.isFinite(amount) && amount > 0) or.push({ amountCents: toCents(amount) });
      filter.$or = or;
    }

    const [total, rows] = await Promise.all([
      this.expenses.countDocuments(filter),
      this.populated(this.expenses.find(filter))
        .sort({ date: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<PopulatedExpense[]>()
        .exec(),
    ]);

    return {
      items: rows.map((row) => toDto(row, user)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async create(categoryId: string, input: ExpenseInput, user: AuthUser) {
    const category = await this.categories.findAccessible(categoryId, user);
    if (!category.canAddExpense) throw new ForbiddenException('You are not allowed to add expenses here');

    const created = await this.expenses.create({
      ...toFields(input),
      category: new Types.ObjectId(categoryId),
      paidBy: new Types.ObjectId(await this.resolvePaidBy(input, user)),
      addedBy: new Types.ObjectId(user.id),
    });
    return this.findOne(created.id as string, user);
  }

  async update(id: string, input: ExpenseInput, user: AuthUser) {
    const existing = await this.findEditable(id, user);
    await this.expenses.updateOne(
      { _id: id },
      {
        ...toFields(input),
        ...(user.role === 'admin' && input.paidById && { paidBy: new Types.ObjectId(await this.resolvePaidBy(input, user)) }),
      },
    );
    if (existing.receiptUrl && existing.receiptUrl !== (input.receiptUrl ?? null)) {
      await deleteUnusedReceiptFiles(this.expenses, [existing.receiptUrl]);
    }
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser) {
    const existing = await this.findEditable(id, user);
    await this.expenses.deleteOne({ _id: id });
    await deleteUnusedReceiptFiles(this.expenses, [existing.receiptUrl]);
  }

  private async resolvePaidBy(input: ExpenseInput, user: AuthUser) {
    if (user.role !== 'admin' || !input.paidById) return user.id;
    await this.users.assertAllExist([input.paidById]);
    return input.paidById;
  }

  /** Admins may edit anything; users only expenses they added, in categories still assigned to them. */
  private async findEditable(id: string, user: AuthUser) {
    const expense = Types.ObjectId.isValid(id) ? await this.expenses.findById(id).lean().exec() : null;
    if (!expense) throw new NotFoundException('Expense not found');
    if (user.role === 'admin') return expense;

    await this.categories.findAccessible(expense.category.toString(), user);
    if (!canUserEdit(expense.addedBy, user)) throw new ForbiddenException('You can only change expenses you added');
    return expense;
  }

  private async findOne(id: string, user: AuthUser) {
    const row = await this.populated(this.expenses.findById(id)).lean<PopulatedExpense>().exec();
    if (!row) throw new NotFoundException('Expense not found');
    return toDto(row, user);
  }

  private populated<Q extends { populate: (path: string, select: string) => Q }>(query: Q) {
    return query
      .populate('category', 'name icon color')
      .populate('paidBy', 'name')
      .populate('addedBy', 'name');
  }
}

const canUserEdit = (addedBy: Types.ObjectId | { _id: Types.ObjectId } | null, user: AuthUser) =>
  user.role === 'admin' ||
  (usersMayAddExpenses() && !!addedBy && ('_id' in addedBy ? addedBy._id : addedBy).toString() === user.id);

function toFields(input: ExpenseInput) {
  return {
    title: input.title.trim(),
    amountCents: toCents(input.amount),
    date: input.date.slice(0, 10),
    note: input.note?.trim() || null,
    receiptUrl: input.receiptUrl ?? null,
  };
}

const ref = (r: Ref | null) => (r ? { id: r._id.toString(), name: r.name } : { id: '', name: 'Deleted user' });

function toDto(row: PopulatedExpense, user: AuthUser) {
  return {
    id: row._id.toString(),
    categoryId: row.category._id.toString(),
    category: {
      id: row.category._id.toString(),
      name: row.category.name,
      icon: row.category.icon,
      color: row.category.color ?? null,
    },
    title: row.title,
    amount: fromCents(row.amountCents),
    date: row.date,
    note: row.note,
    paidBy: ref(row.paidBy),
    addedBy: ref(row.addedBy),
    receiptUrl: row.receiptUrl ?? null,
    canEdit: canUserEdit(row.addedBy, user),
  };
}
