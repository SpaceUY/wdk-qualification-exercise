import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'users', timestamps: true })
export class User {
  // Not a @Prop — this is Mongoose's default `id` virtual (string form of `_id`),
  // declared here only so TypeScript recognizes it on hydrated documents.
  id!: string;

  @Prop({ type: String, required: true, unique: true })
  cognitoSub!: string;

  // email doubles as the WDK walletId — matches the RN app's useAuthStore.userId
  @Prop({ type: String, required: true, unique: true })
  email!: string;

  // Nullable but must stay unique once set — see the partial index below, which allows
  // multiple documents with walletAddress: null (mirrors the Postgres unique-constraint
  // behavior, where multiple NULLs are allowed under a unique constraint).
  @Prop({ type: String, default: null })
  walletAddress!: string | null;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index(
  { walletAddress: 1 },
  { unique: true, partialFilterExpression: { walletAddress: { $type: 'string' } } },
);
