import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Category } from '../categories/category.schema.js';
import { User } from '../users/user.schema.js';

@Schema({ collection: 'expenses', timestamps: true })
export class Expense {
  @Prop({ type: SchemaTypes.ObjectId, ref: Category.name, required: true, index: true })
  category: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;
  @Prop({ required: true })
  amountCents: number;

  /** YYYY-MM-DD */
  @Prop({ required: true, index: true })
  date: string;

  @Prop({ type: String, default: null })
  note: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  paidBy: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  addedBy: Types.ObjectId;

  @Prop({ type: String, default: null })
  receiptUrl: string | null;
}

export type ExpenseDocument = HydratedDocument<Expense>;
export const ExpenseSchema = SchemaFactory.createForClass(Expense);
