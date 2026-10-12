import { parseVoiceCommand } from './voice-command-parser.js';

const categories = [
  { id: 'food', name: 'Food' },
  { id: 'transport', name: 'Transport' },
  { id: 'office-supplies', name: 'Office Supplies' },
];
const users = [
  { id: 'ali', name: 'Ali Khan' },
  { id: 'sara', name: 'Sara Ahmed' },
];

const parse = (text: string) => parseVoiceCommand(text, categories, users);

describe('parseVoiceCommand', () => {
  it('opens pages', () => {
    expect(parse('show me all categories')).toEqual({ type: 'navigate', page: 'categories', q: '' });
    expect(parse('Show all categories.')).toEqual({ type: 'navigate', page: 'categories', q: '' });
    expect(parse('open expenses')).toEqual({ type: 'navigate', page: 'expenses', q: '' });
    expect(parse('go to the dashboard')).toEqual({ type: 'navigate', page: 'overview', q: '' });
    expect(parse('users')).toEqual({ type: 'navigate', page: 'users', q: '' });
    expect(parse('open settings')).toEqual({ type: 'navigate', page: 'settings', q: '' });
    expect(parse('sari categories dikhao')).toEqual({ type: 'navigate', page: 'categories', q: '' });
  });

  it('opens a category by name', () => {
    expect(parse('open food category')).toEqual({ type: 'open-category', categoryId: 'food', q: '' });
    expect(parse('show me office supplies expenses')).toEqual({ type: 'open-category', categoryId: 'office-supplies', q: '' });
    expect(parse('food ki category dikhao')).toEqual({ type: 'open-category', categoryId: 'food', q: '' });
  });

  it('searches for a specific expense', () => {
    expect(parse('show expense lunch with team')).toEqual({ type: 'navigate', page: 'expenses', q: 'lunch with team' });
    expect(parse('find expenses of five hundred rupees')).toEqual({ type: 'navigate', page: 'expenses', q: '500' });
    expect(parse('search uber')).toEqual({ type: 'navigate', page: 'expenses', q: 'uber' });
    expect(parse('show uber expenses in transport')).toEqual({ type: 'open-category', categoryId: 'transport', q: 'uber' });
  });

  it('finds users', () => {
    expect(parse('show user ali')).toEqual({ type: 'navigate', page: 'users', q: 'Ali Khan' });
    expect(parse('search users bilal')).toEqual({ type: 'navigate', page: 'users', q: 'bilal' });
    expect(parse('add user')).toEqual({ type: 'navigate', page: 'users', q: '' });
  });

  it('grants and revokes category access', () => {
    expect(parse('add user Ali to access the food category')).toEqual({
      type: 'access',
      grant: true,
      categoryId: 'food',
      userIds: ['ali'],
    });
    expect(parse('give Sara and Ali Khan access to transport')).toMatchObject({ grant: true, categoryId: 'transport' });
    expect(parse('give Sara and Ali Khan access to transport')).toHaveProperty('userIds.length', 2);
    expect(parse('remove ali from food')).toEqual({ type: 'access', grant: false, categoryId: 'food', userIds: ['ali'] });
    expect(parse("revoke sara's access to transport")).toMatchObject({ type: 'access', grant: false, userIds: ['sara'] });
  });

  it('reports the missing half of an access request', () => {
    expect(parse('give bilal access to food')).toEqual({ type: 'access', grant: true, categoryId: 'food', userIds: [] });
    expect(parse('give ali access')).toEqual({ type: 'access', grant: true, categoryId: null, userIds: ['ali'] });
  });

  it('adds expenses', () => {
    expect(parse('food 500 lunch with team')).toEqual({ type: 'add-expense' });
    expect(parse('add 1200 rupees in transport for uber')).toEqual({ type: 'add-expense' });
    expect(parse('spent 300 on tea')).toEqual({ type: 'add-expense' });
    expect(parse('add expense')).toEqual({ type: 'add-expense' });
  });

  it('creates categories', () => {
    expect(parse('create category travel budget 5000 for ali')).toEqual({ type: 'create-category' });
    expect(parse('category health amount 20000')).toEqual({ type: 'create-category' });
    expect(parse('internet ki category banao')).toEqual({ type: 'create-category' });
  });

  it('changes budgets and statuses', () => {
    expect(parse('set food budget to 5k')).toEqual({ type: 'budget', categoryId: 'food', budget: 5000 });
    expect(parse('deactivate category transport')).toEqual({ type: 'category-status', categoryId: 'transport', active: false });
    expect(parse('make food category active')).toEqual({ type: 'category-status', categoryId: 'food', active: true });
    expect(parse('deactivate user sara')).toEqual({ type: 'user-status', userId: 'sara', active: false });
  });

  it('deletes things', () => {
    expect(parse('delete category food')).toEqual({ type: 'delete-category', categoryId: 'food' });
    expect(parse('delete expense lunch with team')).toEqual({ type: 'delete-expense', categoryId: null, q: 'lunch with team' });
    expect(parse('delete lunch from food')).toEqual({ type: 'delete-expense', categoryId: 'food', q: 'lunch' });
    expect(parse('remove user ali')).toEqual({ type: 'delete-user', userId: 'ali' });
  });

  it('handles app-level commands', () => {
    expect(parse('log out')).toEqual({ type: 'logout' });
    expect(parse('go back')).toEqual({ type: 'back' });
    expect(parse('switch to dark mode')).toEqual({ type: 'theme', theme: 'dark' });
    expect(parse('what can I say')).toEqual({ type: 'help' });
  });

  it('gives up on anything else', () => {
    expect(parse('')).toEqual({ type: 'unknown' });
    expect(parse('hello there')).toEqual({ type: 'unknown' });
  });
});
