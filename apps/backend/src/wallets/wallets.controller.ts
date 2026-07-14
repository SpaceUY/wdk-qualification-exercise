import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { WalletsService } from './wallets.service';
import { UsersService } from '../users/users.service';
import { BackupWalletDto } from './dto/backup-wallet.dto';
import { UpdateWalletAddressDto } from './dto/update-wallet-address.dto';

@ApiTags('wallets')
@ApiBearerAuth('access-token')
@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly usersService: UsersService,
  ) {}

  @Post('backup')
  @ApiOperation({ summary: 'Upsert the encrypted wallet backup for the authenticated user' })
  @ApiResponse({ status: 201, description: 'Backup stored', type: Object })
  async backup(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: BackupWalletDto,
  ): Promise<{ id: string }> {
    const user = await this.usersService.findOrCreate({
      cognitoSub: authUser.sub,
      email: authUser.email,
    });
    const backup = await this.walletsService.upsertBackup(user.id, dto.ciphertext);
    return { id: backup.id };
  }

  @Get('backup/exists')
  @ApiOperation({ summary: 'Check whether the authenticated user already has a cloud wallet backup' })
  @ApiResponse({ status: 200, description: 'Existence flag', type: Object })
  async backupExists(@CurrentUser() authUser: AuthenticatedUser): Promise<{ exists: boolean }> {
    // findByCognitoSub (not findOrCreate): a read-only GET must not create a user row.
    const user = await this.usersService.findByCognitoSub(authUser.sub);
    if (!user) return { exists: false };
    const exists = await this.walletsService.hasBackupForUser(user.id);
    return { exists };
  }

  @Put('address')
  @ApiOperation({ summary: "Register the authenticated user's EVM wallet address" })
  @ApiResponse({ status: 200, description: 'Address registered', type: Object })
  async updateAddress(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: UpdateWalletAddressDto,
  ): Promise<{ walletAddress: string }> {
    const updated = await this.walletsService.registerAddress(
      { cognitoSub: authUser.sub, email: authUser.email },
      dto.walletAddress,
    );
    return { walletAddress: updated.walletAddress as string };
  }
}
