import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { VOICE_ROUTES } from '../routes/index.js';
import { RECEIPT_URL_PATTERN } from '../uploads/receipt-files.js';
import { VoiceService } from './voice.service.js';

class VoiceInput {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  transcript: string;
}

class VoiceExpenseInput extends VoiceInput {
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(RECEIPT_URL_PATTERN, { message: 'receiptUrl must be an uploaded receipt' })
  receiptUrl?: string | null;
}

class ReceiptInput {
  @Matches(RECEIPT_URL_PATTERN, { message: 'receiptUrl must be an uploaded receipt' })
  receiptUrl: string;
}

@Controller(VOICE_ROUTES.BASE)
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Post(VOICE_ROUTES.PARSE)
  @HttpCode(200)
  parse(@Body() dto: VoiceInput, @CurrentUser() user: AuthUser) {
    return this.voice.parse(dto.transcript, user);
  }

  @Post(VOICE_ROUTES.CREATE_EXPENSE)
  createExpense(@Body() dto: VoiceExpenseInput, @CurrentUser() user: AuthUser) {
    return this.voice.createExpense(dto.transcript, user, dto.receiptUrl ?? null);
  }

  @Post(VOICE_ROUTES.READ_RECEIPT)
  @HttpCode(200)
  readReceipt(@Body() dto: ReceiptInput, @CurrentUser() user: AuthUser) {
    return this.voice.readReceipt(dto.receiptUrl, user);
  }

  @Post(VOICE_ROUTES.READ_CATEGORY_IMAGE)
  @HttpCode(200)
  @Roles('admin')
  readCategoryImage(@Body() dto: ReceiptInput, @CurrentUser() user: AuthUser) {
    return this.voice.readCategoryImage(dto.receiptUrl, user);
  }

  @Post(VOICE_ROUTES.CREATE_CATEGORY)
  @Roles('admin')
  createCategory(@Body() dto: VoiceInput, @CurrentUser() user: AuthUser) {
    return this.voice.createCategory(dto.transcript, user);
  }
}
