import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module.js';
import { ExpensesModule } from '../expenses/expenses.module.js';
import { UsersModule } from '../users/users.module.js';
import { VoiceController } from './voice.controller.js';
import { VoiceService } from './voice.service.js';

@Module({
  imports: [CategoriesModule, ExpensesModule, UsersModule],
  controllers: [VoiceController],
  providers: [VoiceService],
})
export class VoiceModule {}
