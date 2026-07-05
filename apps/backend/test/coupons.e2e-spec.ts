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
import { Coupon, CouponDocument } from '../src/coupons/entities/coupon.entity';
import { User, UserDocument } from '../src/users/entities/user.entity';
import { blockchainConfig } from '../src/config/blockchain.config';
import { cognitoConfig } from '../src/config/cognito.config';
import { TEST_USER, createMockJwtAuthGuard } from './support/auth';
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from './support/mongo-memory';
import { MOCK_REDEMPTION_TX_HASH } from './support/ethers-mock';

jest.mock('ethers', () => {
  const {
    createMockUtlContract,
    createMockTreasuryWallet,
    createMockProvider,
    createMockTransactionFrom,
  } = require('./support/ethers-mock');
  return {
    ethers: {
      JsonRpcProvider: jest.fn().mockImplementation(() => createMockProvider()),
      Wallet: jest.fn().mockImplementation(() => createMockTreasuryWallet()),
      Contract: jest.fn().mockImplementation(() => createMockUtlContract()),
      Transaction: { from: createMockTransactionFrom() },
    },
  };
});

jest.setTimeout(60000);

describe('Coupons (e2e)', () => {
  let app: INestApplication;
  let couponModel: Model<CouponDocument>;
  let userModel: Model<UserDocument>;
  let testUserId: string;

  beforeAll(async () => {
    const mongoUri = await startInMemoryMongo();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [blockchainConfig, cognitoConfig] }),
        MongooseModule.forRoot(mongoUri),
        AuthModule,
        UsersModule,
        CouponsModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(createMockJwtAuthGuard(TEST_USER))
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    couponModel = app.get<Model<CouponDocument>>(getModelToken(Coupon.name));
    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo();
  });

  beforeEach(async () => {
    const user = await userModel.create({
      cognitoSub: TEST_USER.sub,
      email: TEST_USER.email,
      walletAddress: null,
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    await clearCollections(app.get(getConnectionToken()));
  });

  it('GET /coupons returns an empty array when the user has no coupons', async () => {
    expect(testUserId).toBeDefined();
    const existingCoupons = await couponModel.find({ userId: testUserId });
    expect(existingCoupons).toHaveLength(0);

    const response = await request(app.getHttpServer()).get('/coupons').expect(200);
    expect(response.body).toEqual([]);
  });

  it('GET /coupons returns unredeemed coupons for the authenticated user', async () => {
    await couponModel.create({
      code: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
      txHash: '0x' + '1'.repeat(64),
      usdtAmountRaw: '100000000',
      utlAmountRaw: '5000000000000000000',
      merchantAddress: '0x' + '2'.repeat(40),
      payerAddress: '0x' + '3'.repeat(40),
      blockNumber: 1,
      userId: testUserId,
      redeemed: false,
    });

    const response = await request(app.getHttpServer()).get('/coupons').expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      code: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
      usdtAmountRaw: '100000000',
      utlAmountRaw: '5000000000000000000',
    });
  });

  it('GET /coupons/claimed returns already-redeemed coupons', async () => {
    await couponModel.create({
      code: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7',
      txHash: '0x' + '4'.repeat(64),
      usdtAmountRaw: '50000000',
      utlAmountRaw: '2500000000000000000',
      merchantAddress: '0x' + '2'.repeat(40),
      payerAddress: '0x' + '3'.repeat(40),
      blockNumber: 2,
      userId: testUserId,
      redeemed: true,
      redeemedAt: new Date(),
      redemptionTxHash: '0x' + '5'.repeat(64),
    });

    const response = await request(app.getHttpServer()).get('/coupons/claimed').expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      usdtAmountRaw: '50000000',
      utlAmountRaw: '2500000000000000000',
      redemptionTxHash: '0x' + '5'.repeat(64),
    });
  });

  it('POST /coupons/claim transfers UTL and marks the coupon redeemed', async () => {
    await userModel.updateOne({ _id: testUserId }, { walletAddress: '0x' + '6'.repeat(40) });
    await couponModel.create({
      code: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8',
      txHash: '0x' + '7'.repeat(64),
      usdtAmountRaw: '100000000',
      utlAmountRaw: '5000000000000000000',
      merchantAddress: '0x' + '2'.repeat(40),
      payerAddress: '0x' + '3'.repeat(40),
      blockNumber: 3,
      userId: testUserId,
      redeemed: false,
    });

    const response = await request(app.getHttpServer())
      .post('/coupons/claim')
      .send({ code: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8' })
      .expect(201);

    expect(response.body).toEqual({ redemptionTxHash: MOCK_REDEMPTION_TX_HASH });

    const updated = await couponModel.findOne({ code: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8' }).lean();
    expect(updated?.redeemed).toBe(true);
    expect(updated?.redemptionTxHash).toBe(MOCK_REDEMPTION_TX_HASH);
  });

  it('POST /coupons/claim rejects an unknown coupon code', async () => {
    await userModel.updateOne({ _id: testUserId }, { walletAddress: '0x' + '6'.repeat(40) });

    await request(app.getHttpServer())
      .post('/coupons/claim')
      .send({ code: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9' })
      .expect(400);
  });

  it('POST /coupons/claim rejects a coupon that is already redeemed', async () => {
    await userModel.updateOne({ _id: testUserId }, { walletAddress: '0x' + '6'.repeat(40) });
    await couponModel.create({
      code: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
      txHash: '0x' + '8'.repeat(64),
      usdtAmountRaw: '100000000',
      utlAmountRaw: '5000000000000000000',
      merchantAddress: '0x' + '2'.repeat(40),
      payerAddress: '0x' + '3'.repeat(40),
      blockNumber: 4,
      userId: testUserId,
      redeemed: true,
      redeemedAt: new Date(),
      redemptionTxHash: '0x' + '9'.repeat(64),
    });

    await request(app.getHttpServer())
      .post('/coupons/claim')
      .send({ code: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0' })
      .expect(400);
  });

  it('POST /coupons/claim rejects a coupon that belongs to a different user', async () => {
    await userModel.updateOne({ _id: testUserId }, { walletAddress: '0x' + '6'.repeat(40) });
    const otherUser = await userModel.create({
      cognitoSub: 'other-cognito-sub',
      email: 'other@example.com',
      walletAddress: '0x' + 'a'.repeat(40),
    });
    await couponModel.create({
      code: 'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
      txHash: '0x' + 'b'.repeat(64),
      usdtAmountRaw: '100000000',
      utlAmountRaw: '5000000000000000000',
      merchantAddress: '0x' + '2'.repeat(40),
      payerAddress: '0x' + '3'.repeat(40),
      blockNumber: 5,
      userId: otherUser.id,
      redeemed: false,
    });

    await request(app.getHttpServer())
      .post('/coupons/claim')
      .send({ code: 'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1' })
      .expect(403);
  });

  it('POST /coupons/claim rejects when the claiming user has no wallet address registered', async () => {
    await couponModel.create({
      code: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
      txHash: '0x' + 'c'.repeat(64),
      usdtAmountRaw: '100000000',
      utlAmountRaw: '5000000000000000000',
      merchantAddress: '0x' + '2'.repeat(40),
      payerAddress: '0x' + '3'.repeat(40),
      blockNumber: 6,
      userId: testUserId,
      redeemed: false,
    });

    await request(app.getHttpServer())
      .post('/coupons/claim')
      .send({ code: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2' })
      .expect(400);
  });
});
