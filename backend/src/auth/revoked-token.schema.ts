import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'revoked_tokens' })
export class RevokedToken {
  @Prop({ required: true, unique: true })
  jti: string;

  // TTL index: MongoDB removes the entry once the token would have expired anyway.
  @Prop({ required: true, expires: 0 })
  expiresAt: Date;
}

export const RevokedTokenSchema = SchemaFactory.createForClass(RevokedToken);
