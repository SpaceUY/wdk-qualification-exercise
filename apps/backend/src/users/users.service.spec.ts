import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

type MockModel = {
  findOne: jest.Mock;
  findOneAndUpdate: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  updateOne: jest.Mock;
};

function createMockModel(): MockModel {
  return {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
  };
}

function duplicateKeyError(): Error {
  return Object.assign(new Error('E11000 duplicate key error'), {
    code: 11000,
    name: 'MongoServerError',
  });
}

describe('UsersService', () => {
  let service: UsersService;
  let userModel: MockModel;

  beforeEach(async () => {
    userModel = createMockModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModel },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findOrCreate', () => {
    it('returns the existing user via the atomic upsert when already present', async () => {
      const existing: Partial<User> = { cognitoSub: 'sub-1', email: 'a@b.com' };
      userModel.findOneAndUpdate.mockResolvedValue(existing);

      const result = await service.findOrCreate({ cognitoSub: 'sub-1', email: 'a@b.com' });

      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        { cognitoSub: 'sub-1' },
        { $setOnInsert: { email: 'a@b.com', walletAddress: null } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      expect(result).toBe(existing);
    });

    it('creates a new user via the atomic upsert when not found', async () => {
      const newUser: Partial<User> = { cognitoSub: 'sub-2', email: 'c@d.com' };
      userModel.findOneAndUpdate.mockResolvedValue(newUser);

      const result = await service.findOrCreate({ cognitoSub: 'sub-2', email: 'c@d.com' });

      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        { cognitoSub: 'sub-2' },
        { $setOnInsert: { email: 'c@d.com', walletAddress: null } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      expect(result).toBe(newUser);
    });

    it('returns the existing user when a concurrent request wins the upsert race', async () => {
      const existing: Partial<User> = { cognitoSub: 'sub-3', email: 'e@f.com' };
      userModel.findOneAndUpdate.mockRejectedValue(duplicateKeyError());
      userModel.findOne.mockResolvedValue(existing);

      const result = await service.findOrCreate({ cognitoSub: 'sub-3', email: 'e@f.com' });

      expect(userModel.findOne).toHaveBeenCalledWith({ cognitoSub: 'sub-3' });
      expect(result).toBe(existing);
    });

    it('throws ConflictException when the duplicate key is a different account\'s email', async () => {
      userModel.findOneAndUpdate.mockRejectedValue(duplicateKeyError());
      userModel.findOne.mockResolvedValue(null);

      await expect(
        service.findOrCreate({ cognitoSub: 'sub-4', email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('rethrows unrelated database errors unchanged', async () => {
      const otherError = new Error('connection lost');
      userModel.findOneAndUpdate.mockRejectedValue(otherError);

      await expect(
        service.findOrCreate({ cognitoSub: 'sub-5', email: 'g@h.com' }),
      ).rejects.toBe(otherError);
    });
  });

  describe('findByCognitoSub', () => {
    it('delegates to findOne', async () => {
      const user: Partial<User> = { cognitoSub: 'sub-1' };
      userModel.findOne.mockResolvedValue(user);

      const result = await service.findByCognitoSub('sub-1');

      expect(userModel.findOne).toHaveBeenCalledWith({ cognitoSub: 'sub-1' });
      expect(result).toBe(user);
    });

    it('returns null when user does not exist', async () => {
      userModel.findOne.mockResolvedValue(null);

      const result = await service.findByCognitoSub('unknown');

      expect(result).toBeNull();
    });
  });

  describe('findByWalletAddress', () => {
    it('lowercases the address before querying', async () => {
      userModel.findOne.mockResolvedValue(null);

      await service.findByWalletAddress('0xABCDEF');

      expect(userModel.findOne).toHaveBeenCalledWith({ walletAddress: '0xabcdef' });
    });
  });

  describe('updateWalletAddress', () => {
    it('updates and returns the refreshed user', async () => {
      const updated: Partial<User> = { walletAddress: '0xabc' };
      userModel.updateOne.mockResolvedValue({ acknowledged: true });
      userModel.findById.mockReturnValue({ orFail: jest.fn().mockResolvedValue(updated) });

      const result = await service.updateWalletAddress('user-1', '0xABC');

      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: 'user-1' },
        { walletAddress: '0xabc' },
      );
      expect(result).toBe(updated);
    });

    it('throws ConflictException when the address is already claimed by another user', async () => {
      userModel.updateOne.mockRejectedValue(duplicateKeyError());

      await expect(service.updateWalletAddress('user-1', '0xabc')).rejects.toThrow(
        ConflictException,
      );
      expect(userModel.findById).not.toHaveBeenCalled();
    });

    it('rethrows unrelated database errors unchanged', async () => {
      const otherError = new Error('connection lost');
      userModel.updateOne.mockRejectedValue(otherError);

      await expect(service.updateWalletAddress('user-1', '0xabc')).rejects.toBe(otherError);
    });
  });
});
