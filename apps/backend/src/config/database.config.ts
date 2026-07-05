import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  uri: process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/cashback_db',
}));
