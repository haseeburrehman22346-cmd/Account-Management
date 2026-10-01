import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ChangePasswordDto, UpdateProfileDto } from '../users/users.dto.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.types.js';
import { CurrentUser, Public } from './decorators.js';
import { AUTH_ROUTES } from '../routes/index.js';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}

@Controller(AUTH_ROUTES.BASE)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Post(AUTH_ROUTES.LOGIN)
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password, dto.remember);
  }

  @Post(AUTH_ROUTES.LOGOUT)
  @HttpCode(204)
  logout(@CurrentUser() user: AuthUser) {
    return this.auth.logout(user);
  }

  @Get(AUTH_ROUTES.ME)
  me(@CurrentUser() user: AuthUser) {
    return this.users.getProfile(user.id);
  }

  @Put(AUTH_ROUTES.ME)
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto.name);
  }

  @Put(AUTH_ROUTES.CHANGE_PASSWORD)
  @HttpCode(204)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
