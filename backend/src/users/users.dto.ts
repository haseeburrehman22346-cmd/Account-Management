import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Role } from '../auth/auth.types.js';

class UserFields {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsIn(['admin', 'user'])
  role: Role;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  categoryIds?: string[];
}

export class CreateUserDto extends UserFields {
  @IsString()
  @MinLength(6)
  password: string;
}

export class UpdateUserDto extends UserFields {
  /** Optional password reset by an admin. */
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

export class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
