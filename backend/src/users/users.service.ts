import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { containsRegex } from '../common/query.js';
import { Category } from '../categories/category.schema.js';
import { Expense } from '../expenses/expense.schema.js';
import type { CreateUserDto, UpdateUserDto } from './users.dto.js';
import { User } from './user.schema.js';

type UserLean = User & { _id: Types.ObjectId };

const toDto = (user: UserLean) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active !== false,
});

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Category.name) private readonly categories: Model<Category>,
    @InjectModel(Expense.name) private readonly expenses: Model<Expense>,
  ) {}

  async onApplicationBootstrap() {
    if (await this.users.exists({})) return;
    const email = process.env.ADMIN_EMAIL ?? 'admin@example.com';
    await this.create({
      name: process.env.ADMIN_NAME ?? 'Administrator',
      email,
      password: process.env.ADMIN_PASSWORD ?? 'admin123',
      role: 'admin',
    });
    this.logger.warn(`Seeded admin account ${email} — change the password for production use.`);
  }

  findByEmailWithPassword(email: string) {
    return this.users.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash').exec();
  }

  /** Current role/status for the auth guard, so role changes and deactivation apply immediately. */
  findForAuth(id: string) {
    return this.users.findById(id).select('name email role active').lean<UserLean>().exec();
  }

  async list(q?: string) {
    const regex = containsRegex(q);
    const filter = regex ? { $or: [{ name: regex }, { email: regex }] } : {};
    const [users, categories] = await Promise.all([
      this.users.find(filter).collation({ locale: 'en' }).sort({ role: 1, name: 1 }).lean<UserLean[]>().exec(),
      this.categories
        .find({}, { name: 1, assignedUsers: 1 })
        .collation({ locale: 'en' })
        .sort({ name: 1 })
        .lean<{ _id: Types.ObjectId; name: string; assignedUsers: Types.ObjectId[] }[]>()
        .exec(),
    ]);

    return users.map((user) => ({
      ...toDto(user),
      createdAt: user.createdAt,
      categories: categories
        .filter((c) => c.assignedUsers.some((u) => u.equals(user._id)))
        .map((c) => ({ id: c._id.toString(), name: c.name })),
    }));
  }

  async getProfile(id: string) {
    const user = await this.users.findById(id).lean<UserLean>().exec();
    if (!user) throw new NotFoundException('User not found');
    return toDto(user);
  }

  async assertAllExist(ids: string[]) {
    if (!ids.length) return;
    const count = await this.users.countDocuments({ _id: { $in: ids } });
    if (count !== ids.length) throw new BadRequestException('One or more users do not exist');
  }

  async create(input: CreateUserDto) {
    const user = await this.withUniqueEmail(() =>
      this.users.create({
        name: input.name,
        email: input.email,
        passwordHash: bcrypt.hashSync(input.password, 10),
        role: input.role,
        active: input.active ?? true,
      }),
    );
    if (input.categoryIds) await this.setCategoryAccess(user._id, input.categoryIds);
    return toDto(user.toObject());
  }

  async update(id: string, input: UpdateUserDto, currentUserId: string) {
    if (id === currentUserId && (input.role !== 'admin' || input.active === false)) {
      throw new BadRequestException('You cannot demote or deactivate your own account');
    }
    const update: Partial<User> = { name: input.name, email: input.email, role: input.role };
    if (input.active !== undefined) update.active = input.active;
    if (input.password) update.passwordHash = bcrypt.hashSync(input.password, 10);

    const user = await this.withUniqueEmail(() =>
      this.users.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true }).lean<UserLean>().exec(),
    );
    if (!user) throw new NotFoundException('User not found');
    if (input.categoryIds) await this.setCategoryAccess(user._id, input.categoryIds);
    return toDto(user);
  }

  async updateProfile(id: string, name: string) {
    const user = await this.users.findByIdAndUpdate(id, { name }, { returnDocument: 'after' }).lean<UserLean>().exec();
    if (!user) throw new NotFoundException('User not found');
    return toDto(user);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.users.findById(id).select('+passwordHash').exec();
    if (!user) throw new NotFoundException('User not found');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
  }

  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) throw new BadRequestException('You cannot delete your own account');

    const hasHistory =
      (await this.categories.exists({ createdBy: id })) ||
      (await this.expenses.exists({ $or: [{ addedBy: id }, { paidBy: id }] }));
    if (hasHistory) {
      throw new ConflictException('User has recorded categories or expenses — deactivate them instead');
    }

    const { deletedCount } = await this.users.deleteOne({ _id: id });
    if (!deletedCount) throw new NotFoundException('User not found');
    await this.categories.updateMany({}, { $pull: { assignedUsers: new Types.ObjectId(id) } });
  }

  private async setCategoryAccess(userId: Types.ObjectId, categoryIds: string[]) {
    const ids = categoryIds.map((c) => new Types.ObjectId(c));
    await this.categories.updateMany({ _id: { $nin: ids } }, { $pull: { assignedUsers: userId } });
    await this.categories.updateMany({ _id: { $in: ids } }, { $addToSet: { assignedUsers: userId } });
  }

  private async withUniqueEmail<T>(fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw new ConflictException('Email already in use');
      throw err;
    }
  }
}
