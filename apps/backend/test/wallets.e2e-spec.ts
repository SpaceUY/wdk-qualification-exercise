import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken, getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { CouponsModule } from '../src/coupons/coupons.module';
import { WalletsModule } from '../src/wallets/wallets.module';
import { Coupon, CouponDocument } from '../src/coupons/entities/coupon.entity';
import { User, UserDocument } from '../src/users/entities/user.entity';
import {
  EncryptedBackup,
  EncryptedBackupDocument,
} from '../src/wallets/entities/encrypted-backup.entity';
import { blockchainConfig } from '../src/config/blockchain.config';
import { cognitoConfig } from '../src/config/cognito.config';
import { CACHE_REDIS_CLIENT } from '../src/redis/redis-cache.tokens';
import { TEST_USER, createMockJwtAuthGuard } from './support/auth';
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from './support/mongo-memory';
import { createMockRedisClient } from './support/redis-mock';

jest.mock('ethers', () => {
  const { createMockUtlContract } = require('./support/ethers-mock');
  return {
    ethers: {
      JsonRpcProvider: jest.fn(),
      Wallet: jest.fn(),
      Contract: jest.fn().mockImplementation(() => createMockUtlContract()),
    },
  };
});

describe('Wallets (e2e)', () => {
  let app: INestApplication;
  let userModel: Model<UserDocument>;
  let couponModel: Model<CouponDocument>;
  let backupModel: Model<EncryptedBackupDocument>;

  beforeAll(async () => {
    const mongoUri = await startInMemoryMongo();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [blockchainConfig, cognitoConfig] }),
        MongooseModule.forRoot(mongoUri),
        AuthModule,
        UsersModule,
        CouponsModule,
        WalletsModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(createMockJwtAuthGuard(TEST_USER))
      // CouponsModule pulls in RedisCacheModule for the treasury lock; stub the
      // client so the e2e run needs no Redis instance.
      .overrideProvider(CACHE_REDIS_CLIENT)
      .useValue(createMockRedisClient())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    couponModel = app.get<Model<CouponDocument>>(getModelToken(Coupon.name));
    backupModel = app.get<Model<EncryptedBackupDocument>>(getModelToken(EncryptedBackup.name));
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo();
  });

  afterEach(async () => {
    await clearCollections(app.get(getConnectionToken()));
  });

  it('PUT /wallets/address registers a wallet address and links orphaned coupons', async () => {
    const walletAddress = '0x' + 'd'.repeat(40);
    await couponModel.create({
      code: 'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3',
      txHash: '0x' + 'e'.repeat(64),
      usdtAmountRaw: '100000000',
      utlAmountRaw: '5000000000000000000',
      merchantAddress: '0x' + '2'.repeat(40),
      payerAddress: walletAddress.toLowerCase(),
      blockNumber: 1,
      userId: null,
      redeemed: false,
    });

    const response = await request(app.getHttpServer())
      .put('/wallets/address')
      .send({ walletAddress })
      .expect(200);

    expect(response.body).toEqual({ walletAddress: walletAddress.toLowerCase() });

    const user = await userModel.findOne({ cognitoSub: TEST_USER.sub }).lean();
    expect(user?.walletAddress).toBe(walletAddress.toLowerCase());

    const coupon = await couponModel.findOne({ code: 'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3' }).lean();
    expect(coupon?.userId).toBe(user?._id.toString());
  });

  it('POST /wallets/backup upserts the encrypted backup for the authenticated user', async () => {
    const ciphertextBlob = Buffer.alloc(61, 0);
    ciphertextBlob[0] = 0x01;
    const ciphertext = ciphertextBlob.toString('base64');

    const response = await request(app.getHttpServer())
      .post('/wallets/backup')
      .send({ ciphertext })
      .expect(201);

    expect(response.body.id).toBeDefined();

    const user = await userModel.findOne({ cognitoSub: TEST_USER.sub }).lean();
    const backup = await backupModel.findOne({ userId: user?._id.toString() }).lean();
    expect(backup?.ciphertext).toBe(ciphertext);
  });
});
