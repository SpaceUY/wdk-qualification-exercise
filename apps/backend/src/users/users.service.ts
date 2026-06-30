import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

export interface FindOrCreateParams {
  cognitoSub: string;
  email: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async findOrCreate(params: FindOrCreateParams): Promise<User> {
    const existing = await this.usersRepo.findOne({
      where: { cognitoSub: params.cognitoSub },
    });
    if (existing) return existing;

    const user = this.usersRepo.create({
      cognitoSub: params.cognitoSub,
      email: params.email,
      walletAddress: null,
    });
    return this.usersRepo.save(user);
  }

  async findByCognitoSub(cognitoSub: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { cognitoSub } });
  }

  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.usersRepo.findOne({
      where: { walletAddress: walletAddress.toLowerCase() },
    });
  }

  async updateWalletAddress(userId: string, walletAddress: string): Promise<User> {
    await this.usersRepo.update(userId, {
      walletAddress: walletAddress.toLowerCase(),
    });
    return this.usersRepo.findOneOrFail({ where: { id: userId } });
  }
}
