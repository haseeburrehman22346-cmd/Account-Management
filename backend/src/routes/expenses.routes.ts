/** Expenses live under two parents, so the controller has no base path. */
export const EXPENSES_ROUTES = {
  BASE: '',
  SEARCH: 'expenses',
  LIST_BY_CATEGORY: 'categories/:id/expenses',
  CREATE_IN_CATEGORY: 'categories/:id/expenses',
  UPDATE: 'expenses/:id',
  DELETE: 'expenses/:id',
} as const;
