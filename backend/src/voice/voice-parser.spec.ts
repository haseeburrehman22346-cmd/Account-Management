import { parseVoiceExpense } from './voice-parser.js';

const categories = [
  { id: 'food', name: 'Food' },
  { id: 'transport', name: 'Transport' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'office', name: 'Office' },
  { id: 'office-supplies', name: 'Office Supplies' },
];
const today = new Date(2026, 8, 25); // 25 Sep 2026

const parse = (text: string) => parseVoiceExpense(text, categories, today);

describe('parseVoiceExpense', () => {
  it('reads category, amount and title from a simple sentence', () => {
    expect(parse('Food 500 lunch with team')).toMatchObject({
      categoryId: 'food',
      amount: 500,
      title: 'Lunch with team',
      date: '2026-09-25',
      missing: [],
    });
  });

  it('handles filler words and currency', () => {
    expect(parse('Add 1,200 rupees in transport for uber ride')).toMatchObject({
      categoryId: 'transport',
      amount: 1200,
      title: 'Uber ride',
    });
  });

  it('understands k, thousand and hazar', () => {
    expect(parse('utilities 2.5k electricity bill').amount).toBe(2500);
    expect(parse('transport two thousand five hundred fuel').amount).toBe(2500);
    expect(parse('food 3 hazar groceries').amount).toBe(3000);
    expect(parse('food five hundred rupees snacks').amount).toBe(500);
  });

  it('matches plurals and small speech-recognition slips', () => {
    expect(parse('transports 300 rickshaw').categoryId).toBe('transport');
    expect(parse('utilitys 900 water').categoryId).toBe('utilities');
  });

  it('prefers the longest category name', () => {
    expect(parse('office supplies 450 printer paper')).toMatchObject({
      categoryId: 'office-supplies',
      title: 'Printer paper',
    });
  });

  it('prefers the number next to a currency word', () => {
    expect(parse('food 2 pizzas for 1800 rupees')).toMatchObject({ amount: 1800, title: '2 pizzas' });
  });

  it('reads relative dates in English and Roman Urdu', () => {
    expect(parse('food 200 tea yesterday').date).toBe('2026-09-24');
    expect(parse('kal food mein 200 ka kharcha chai').date).toBe('2026-09-24');
    expect(parse('food 200 day before yesterday dinner')).toMatchObject({ date: '2026-09-23', title: 'Dinner' });
    expect(parse('parson transport 100').date).toBe('2026-09-23');
  });

  it('handles Roman Urdu sentences', () => {
    expect(parse('food mein 700 rupay ka khana')).toMatchObject({ categoryId: 'food', amount: 700, title: 'Khana' });
  });

  it('drops Roman Urdu request phrasing from the title', () => {
    expect(parse('transport ki category mein 300 add karna chahta hoon rickshaw')).toMatchObject({
      categoryId: 'transport',
      amount: 300,
      title: 'Rickshaw',
    });
    expect(parse('amount kar do aap').title).toBe('');
  });

  it('converts Urdu digits', () => {
    expect(parse('food ۵۰۰ lunch').amount).toBe(500);
  });

  it('reports what is missing', () => {
    expect(parse('lunch with team 500').missing).toEqual(['category']);
    expect(parse('food lunch').missing).toEqual(['amount']);
    expect(parse('').missing).toEqual(['category', 'amount']);
  });

  it('falls back to the category name when no title words remain', () => {
    expect(parse('food 500').title).toBe('Food');
  });
});
