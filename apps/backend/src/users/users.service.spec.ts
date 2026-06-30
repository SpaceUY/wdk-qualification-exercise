import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { ObjectLiteral, Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

type MockRepo<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function createMockRepo<T extends ObjectLiteral>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let repo: MockRepo<User>;

  beforeEach(async () => {
    repo = createMockRepo<User>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findOrCreate', () => {
    it('returns existing user when found by cognitoSub', async () => {
      const existing: Partial<User> = { id: 'uuid-1', cognitoSub: 'sub-1', email: 'a@b.com' };
      (repo.findOne as jest.Mock).mockResolvedValue(existing);

      const result = await service.findOrCreate({ cognitoSub: 'sub-1', email: 'a@b.com' });

      expect(result).toBe(existing);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('creates and saves a new user when not found', async () => {
      const newUser: Partial<User> = { id: 'uuid-2', cognitoSub: 'sub-2', email: 'c@d.com' };
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      (repo.create as jest.Mock).mockReturnValue(newUser);
      (repo.save as jest.Mock).mockResolvedValue(newUser);

      const result = await service.findOrCreate({ cognitoSub: 'sub-2', email: 'c@d.com' });

      expect(repo.create).toHaveBeenCalledWith({
        cognitoSub: 'sub-2',
        email: 'c@d.com',
        walletAddress: null,
      });
      expect(repo.save).toHaveBeenCalledWith(newUser);
      expect(result).toBe(newUser);
    });
  });

  describe('findByCognitoSub', () => {
    it('delegates to repository findOne', async () => {
      const user: Partial<User> = { id: 'uuid-1' };
      (repo.findOne as jest.Mock).mockResolvedValue(user);

      const result = await service.findByCognitoSub('sub-1');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { cognitoSub: 'sub-1' } });
      expect(result).toBe(user);
    });

    it('returns null when user does not exist', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.findByCognitoSub('unknown');

      expect(result).toBeNull();
    });
  });

  describe('findByWalletAddress', () => {
    it('lowercases the address before querying', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await service.findByWalletAddress('0xABCDEF');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { walletAddress: '0xabcdef' },
      });
    });
  });

  describe('updateWalletAddress', () => {
    it('updates and returns the refreshed user', async () => {
      const updated: Partial<User> = { id: 'uuid-1', walletAddress: '0xabc' };
      (repo.update as jest.Mock).mockResolvedValue(undefined);
      (repo.findOneOrFail as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateWalletAddress('uuid-1', '0xABC');

      expect(repo.update).toHaveBeenCalledWith('uuid-1', { walletAddress: '0xabc' });
      expect(result).toBe(updated);
    });
  });
});
