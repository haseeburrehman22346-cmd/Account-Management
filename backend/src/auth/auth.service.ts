import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { UsersService } from '../users/users.service.js';
import type { AuthUser } from './auth.types.js';
import { RevokedToken } from './revoked-token.schema.js';

const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    @InjectModel(RevokedToken.name) private readonly revokedTokens: Model<RevokedToken>,
  ) {}

  async login(email: string, password: string, remember = false) {
    const user = await this.users.findByEmailWithPassword(email);

    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Invalid email or password');
    if (user.active === false) throw new ForbiddenException('Your account has been deactivated');

    const id = user.id as string;
    const token = await this.jwt.signAsync(
      { sub: id, email: user.email, name: user.name, role: user.role },
      { jwtid: randomUUID(), expiresIn: remember ? '30d' : '8h' },
    );
    return {
      token,
      role: user.role,
      user: { id, name: user.name, email: user.email, role: user.role, active: true },
    };
  }

  async logout(user: AuthUser) {
    await this.revokedTokens.updateOne(
      { jti: user.jti },
      { jti: user.jti, expiresAt: new Date(user.exp * 1000) },
      { upsert: true },
    );
  }

  async isRevoked(jti: string) {
    return (await this.revokedTokens.exists({ jti })) !== null;
  }
}
