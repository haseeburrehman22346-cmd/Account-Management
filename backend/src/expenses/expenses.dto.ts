import {
  IsDateString,
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
import { PageQuery } from '../common/query.js';
import { RECEIPT_URL_PATTERN } from '../uploads/receipt-files.js';

export class ExpenseInput {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  /** ISO date, e.g. 2026-09-25 */
  @IsDateString({ strict: true })
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;

  /** Admins only; users always record expenses as paid by themselves. */
  @IsOptional()
  @IsMongoId()
  paidById?: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(RECEIPT_URL_PATTERN, { message: 'receiptUrl must be an uploaded receipt' })
  receiptUrl?: string | null;
}

export class ExpenseQuery extends PageQuery {
  @IsOptional()
  @IsMongoId()
  categoryId?: string;
}
