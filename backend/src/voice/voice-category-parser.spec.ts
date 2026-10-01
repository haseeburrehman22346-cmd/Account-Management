import { parseVoiceCategory, pickCategoryIcon } from './voice-category-parser.js';

const users = [
  { id: 'ali', name: 'Ali Khan' },
  { id: 'sara', name: 'Sara Ahmed' },
  { id: 'bilal', name: 'Bilal Khan' },
];
const existing = [{ id: 'transport', name: 'Transport' }];

const parse = (text: string) => parseVoiceCategory(text, users, existing);

describe('parseVoiceCategory', () => {
  it('reads name and budget', () => {
    expect(parse('category food amount 20000')).toMatchObject({
      name: 'Food',
      budget: 20000,
      icon: 'utensils',
      userIds: [],
      duplicateOf: null,
      missing: [],
    });
  });

  it('handles "create new category" phrasing and k / hazar budgets', () => {
    expect(parse('create a new category office supplies with budget 15k')).toMatchObject({
      name: 'Office Supplies',
      budget: 15000,
      icon: 'briefcase',
    });
    expect(parse('internet ki category banao 5 hazar budget')).toMatchObject({ name: 'Internet', budget: 5000, icon: 'wifi' });
  });

  it('works without a budget', () => {
    expect(parse('new category health')).toMatchObject({ name: 'Health', budget: null, icon: 'heart-pulse' });
  });

  it('assigns users by full name or unique first name', () => {
    expect(parse('category groceries budget 30000 for Ali Khan and Sara').userIds.sort()).toEqual(['ali', 'sara']);
    expect(parse('category groceries for sara').name).toBe('Groceries');
  });

  it('does not guess a user from a shared first name', () => {
    const shared = parseVoiceCategory('category rent for ali', [...users, { id: 'ali2', name: 'Ali Raza' }], []);
    expect(shared.userIds).toEqual([]);
  });

  it('flags an existing category instead of duplicating it', () => {
    expect(parse('category transport 5000')).toMatchObject({ name: 'Transport', duplicateOf: 'transport' });
  });

  it('reports a missing name', () => {
    expect(parse('create category budget 5000')).toMatchObject({ name: '', missing: ['name'] });
  });

  it('falls back to the folder icon', () => {
    expect(pickCategoryIcon('Miscellaneous')).toBe('folder');
  });
});
