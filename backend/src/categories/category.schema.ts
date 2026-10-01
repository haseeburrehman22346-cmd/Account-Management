import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { User } from '../users/user.schema.js';

export type CategoryStatus = 'active' | 'inactive';

@Schema({ collection: 'categories', timestamps: true })
export class Category {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: '', trim: true })
  description: string;

  /** Icon key from the frontend's icon set, e.g. "utensils". */
  @Prop({ type: String, default: null })
  icon: string | null;

  /** Color key from the frontend's palette, e.g. "green". */
  @Prop({ type: String, default: null })
  color: string | null;

  @Prop({ type: Number, default: null })
  budgetLimitCents: number | null;

  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active' })
  status: CategoryStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: User.name }], default: [], index: true })
  assignedUsers: Types.ObjectId[];
}

export type CategoryDocument = HydratedDocument<Category>;
export const CategorySchema = SchemaFactory.createForClass(Category);
