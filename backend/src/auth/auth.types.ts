export type Role = 'admin' | 'user';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  jti: string;
  /** Token expiry, in seconds since epoch. */
  exp: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
  jti: string;
  exp: number;
}
