import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken, getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';
import { Model } from 'mongoose';
import type { Job } from 'bull';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { CouponsModule } from '../src/coupons/coupons.module';
import { Coupon, CouponDocument, CouponSchema } from '../src/coupons/entities/coupon.entity';
import { User, UserDocument } from '../src/users/entities/user.entity';
import { blockchainConfig } from '../src/config/blockchain.config';
import { cognitoConfig } from '../src/config/cognito.config';
import { TransferProcessor } from '../src/modules/indexer/processors/transfer.processor';
import { TransferEventDto } from '../src/modules/indexer/dto/transfer-event.dto';
import { CACHE_REDIS_CLIENT } from '../src/redis/redis-cache.tokens';
import { TEST_USER, createMockJwtAuthGuard } from './support/auth';
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from './support/mongo-memory';
import { MOCK_REDEMPTION_TX_HASH } from './support/ethers-mock';
import { createMockRedisClient } from './support/redis-mock';

const MERCHANT_ADDRESS = '0x' + '1'.repeat(40);
const PAYER_ADDRESS = '0x' + '2'.repeat(40);

process.env['MERCHANT_ADDRESSES'] = MERCHANT_ADDRESS;

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

describe('Cashback flow (e2e)', () => {
  let app: INestApplication;
  let userModel: Model<UserDocument>;
  let couponModel: Model<CouponDocument>;
  let transferProcessor: TransferProcessor;

  beforeAll(async () => {
    const mongoUri = await startInMemoryMongo();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [blockchainConfig, cognitoConfig] }),
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: Coupon.name, schema: CouponSchema }]),
        AuthModule,
        UsersModule,
        CouponsModule,
      ],
      providers: [TransferProcessor],
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
    transferProcessor = app.get(TransferProcessor);
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo();
  });

  afterEach(async () => {
    await clearCollections(app.get(getConnectionToken()));
  });

  it('turns a simulated merchant transfer into a coupon the user can list, claim, and see as claimed', async () => {
    await userModel.create({
      cognitoSub: TEST_USER.sub,
      email: TEST_USER.email,
      walletAddress: PAYER_ADDRESS.toLowerCase(),
    });

    const transferEvent: TransferEventDto = {
      from: PAYER_ADDRESS,
      to: MERCHANT_ADDRESS,
      amount: '100000000',
      txHash: '0x' + '3'.repeat(64),
      chain: 'ethereum',
    };

    await transferProcessor.handle({ data: transferEvent } as Job<TransferEventDto>);

    const coupon = await couponModel
      .findOne({ txHash: transferEvent.txHash.toLowerCase() })
      .lean();
    expect(coupon).toBeTruthy();
    expect(coupon?.utlAmountRaw).toBe('5000000000000000000');
    expect(coupon?.redeemed).toBe(false);

    const listResponse = await request(app.getHttpServer()).get('/coupons').expect(200);
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].code).toBe(coupon?.code);

    const claimResponse = await request(app.getHttpServer())
      .post('/coupons/claim')
      .send({ code: coupon?.code })
      .expect(201);
    expect(claimResponse.body).toEqual({ redemptionTxHash: MOCK_REDEMPTION_TX_HASH });

    const claimedResponse = await request(app.getHttpServer())
      .get('/coupons/claimed')
      .expect(200);
    expect(claimedResponse.body).toHaveLength(1);

    const stillUnclaimed = await request(app.getHttpServer()).get('/coupons').expect(200);
    expect(stillUnclaimed.body).toHaveLength(0);
  });
});
