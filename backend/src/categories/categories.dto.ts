import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { CategoryStatus } from './category.schema.js';

const KEY = /^[a-z0-9-]{1,32}$/;

export class CategoryInput {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(KEY)
  icon?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(KEY)
  color?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetLimit?: number | null;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: CategoryStatus;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  assignedUserIds?: string[];
}
