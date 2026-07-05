import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';

const MONGO_DUPLICATE_KEY = 11000;

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as Record<string, unknown>)['code'] === MONGO_DUPLICATE_KEY
  );
}

export interface FindOrCreateParams {
  cognitoSub: string;
  email: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findOrCreate(params: FindOrCreateParams): Promise<UserDocument> {
    try {
      return await this.userModel.findOneAndUpdate(
        { cognitoSub: params.cognitoSub },
        { $setOnInsert: { email: params.email, walletAddress: null } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        // A concurrent request may have already created this exact user (a known
        // MongoDB caveat: concurrent upserts on the same key can still race at the
        // storage layer), or the email collides with a different existing account.
        const existing = await this.userModel.findOne({ cognitoSub: params.cognitoSub });
        if (existing) return existing;
        throw new ConflictException('Email already registered to another account');
      }
      throw err;
    }
  }

  async findByCognitoSub(cognitoSub: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ cognitoSub });
  }

  async findByWalletAddress(walletAddress: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ walletAddress: walletAddress.toLowerCase() });
  }

  async updateWalletAddress(userId: string, walletAddress: string): Promise<UserDocument> {
    try {
      await this.userModel.updateOne(
        { _id: userId },
        { walletAddress: walletAddress.toLowerCase() },
      );
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictException('Wallet address already registered to another account');
      }
      throw err;
    }
    return this.userModel.findById(userId).orFail();
  }
}
