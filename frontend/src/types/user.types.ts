export type Role = "admin" | "user";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface UserRef {
  id: string;
  name: string;
}

/** A user as listed on the admin Users page, with the categories they can access. */
export interface ManagedUser extends User {
  createdAt: string;
  categories: UserRef[];
}

export interface UserInput {
  name: string;
  email: string;
  role: Role;
  active: boolean;
  categoryIds: string[];
  /** Required when creating; optional reset when editing. */
  password?: string;
}
