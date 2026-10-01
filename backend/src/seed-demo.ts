/**
 * Fills an empty database with demo users, categories and ~6 months of expenses.
 * Usage: npm run seed:demo   (refuses to run if any categories already exist)
 */
import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { existsSync } from 'node:fs';
import { Category, CategorySchema } from './categories/category.schema.js';
import { lastMonths } from './common/dates.js';
import { Expense, ExpenseSchema } from './expenses/expense.schema.js';
import { User, UserSchema } from './users/user.schema.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const DEMO_PASSWORD = 'password123';

const USERS = [
  ['Ali Khan', 'ali@example.com'],
  ['Sara Ahmed', 'sara@example.com'],
  ['Hassan Raza', 'hassan@example.com'],
  ['Fatima Noor', 'fatima@example.com'],
  ['Bilal Khan', 'bilal@example.com'],
  ['Ayesha Malik', 'ayesha@example.com'],
  ['Umair Sheikh', 'umair@example.com'],
] as const;

type Seed = {
  name: string;
  description: string;
  icon: string;
  color: string;
  users: number[];
  items: [string, number, number][]; // title, min amount, max amount
};

const CATEGORIES: Seed[] = [
  {
    name: 'Food',
    description: 'Meals, groceries, dining',
    icon: 'utensils',
    color: 'green',
    users: [0, 1, 2, 3],
    items: [['Lunch - Team', 1500, 3500], ['Groceries', 3000, 7000], ['Dinner - Client', 2500, 6000], ['Office Snacks', 800, 2000], ['Tea & Refreshments', 500, 1200]],
  },
  {
    name: 'Transport',
    description: 'Fuel, commuting, travel',
    icon: 'car',
    color: 'blue',
    users: [0, 2, 5, 1],
    items: [['Office Fuel', 3000, 6000], ['Ride Hailing', 600, 1800], ['Parking', 200, 600], ['Vehicle Maintenance', 4000, 12000]],
  },
  {
    name: 'Office',
    description: 'Office supplies, equipment',
    icon: 'briefcase',
    color: 'orange',
    users: [1, 5, 2],
    items: [['Stationery', 800, 2500], ['Printer Toner', 3000, 6000], ['Desk Accessories', 1500, 4000]],
  },
  {
    name: 'Utilities',
    description: 'Electricity, internet, water',
    icon: 'zap',
    color: 'violet',
    users: [0, 5],
    items: [['Electricity Bill', 9000, 16000], ['Internet', 4000, 6000], ['Water Bill', 1500, 3000]],
  },
  {
    name: 'Entertainment',
    description: 'Movies, events, recreation',
    icon: 'film',
    color: 'magenta',
    users: [4, 3],
    items: [['Team Outing', 5000, 15000], ['Movie Night', 2000, 5000], ['Event Tickets', 3000, 8000]],
  },
  {
    name: 'Others',
    description: 'Miscellaneous expenses',
    icon: 'ellipsis',
    color: 'slate',
    users: [6],
    items: [['Courier', 400, 1500], ['Gifts', 2000, 6000], ['Miscellaneous', 500, 3000]],
  },
];

const random = (min: number, max: number) => Math.round(min + Math.random() * (max - min));

async function main() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/MoneyManager';
  await mongoose.connect(uri);
  const Users = mongoose.model(User.name, UserSchema);
  const Categories = mongoose.model(Category.name, CategorySchema);
  const Expenses = mongoose.model(Expense.name, ExpenseSchema);

  if (await Categories.exists({})) {
    console.error(`Refusing to seed: ${uri} already has categories. Use an empty database.`);
    process.exitCode = 1;
    return;
  }

  let admin = await Users.findOne({ role: 'admin' });
  admin ??= await Users.create({
    name: process.env.ADMIN_NAME ?? 'Administrator',
    email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
    passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD ?? 'admin123', 10),
    role: 'admin',
  });

  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const users: Types.ObjectId[] = [];
  for (const [name, email] of USERS) {
    const user = await Users.findOneAndUpdate(
      { email },
      { $setOnInsert: { name, email, passwordHash, role: 'user', active: true } },
      { upsert: true, returnDocument: 'after' },
    );
    users.push(user._id);
  }

  const months = lastMonths(6);
  const today = new Date();
  let expenseCount = 0;

  for (const seed of CATEGORIES) {
    const category = await Categories.create({
      name: seed.name,
      description: seed.description,
      icon: seed.icon,
      color: seed.color,
      status: 'active',
      createdBy: admin._id,
      assignedUsers: seed.users.map((i) => users[i]),
    });

    const docs = months.flatMap((month, monthIndex) => {
      const [y, m] = month.split('-').map(Number);
      const lastDay = monthIndex === months.length - 1 ? today.getDate() : new Date(y, m, 0).getDate();
      return Array.from({ length: random(3, 7) }, () => {
        const [title, min, max] = seed.items[random(0, seed.items.length - 1)];
        const payer = users[seed.users[random(0, seed.users.length - 1)]];
        return {
          category: category._id,
          title,
          amountCents: random(min, max) * 100,
          date: `${month}-${String(random(1, lastDay)).padStart(2, '0')}`,
          note: null,
          paidBy: payer,
          addedBy: Math.random() < 0.5 ? payer : admin._id,
        };
      });
    });
    await Expenses.insertMany(docs);
    expenseCount += docs.length;
  }

  console.log(`Seeded ${USERS.length} users, ${CATEGORIES.length} categories and ${expenseCount} expenses into ${uri}`);
  console.log(`Demo users sign in with password "${DEMO_PASSWORD}" (e.g. ali@example.com).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
