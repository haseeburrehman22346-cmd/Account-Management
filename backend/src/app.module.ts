import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { ExpensesModule } from './expenses/expenses.module.js';
import { UploadsController } from './uploads/uploads.controller.js';
import { UsersModule } from './users/users.module.js';
import { VoiceModule } from './voice/voice.module.js';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/MoneyManager',
      }),
    }),
    AuthModule,
    UsersModule,
    CategoriesModule,
    ExpensesModule,
    DashboardModule,
    VoiceModule,
  ],
  controllers: [AppController, UploadsController],
  providers: [AppService],
})
export class AppModule {}
