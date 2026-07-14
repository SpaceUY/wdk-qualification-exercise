import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { WdkAppNodeService } from './wdk-app-node.service';
import { TokenTransfersService, type TokenTransfer } from './token-transfers.service';
import { TokenTransfersQueryDto } from './dto/token-transfers-query.dto';

@ApiTags('wdk-app-node')
@ApiBearerAuth('access-token')
@Controller('wdk-app-node')
@UseGuards(JwtAuthGuard)
export class WdkAppNodeController {
  constructor(
    private readonly wdkAppNodeService: WdkAppNodeService,
    private readonly tokenTransfersService: TokenTransfersService,
  ) {}

  @Get('token')
  @ApiOperation({
    summary:
      "Mint a short-lived JWT for the self-hosted WDK app-node API, scoped to the authenticated user's wallet id (their Cognito email)",
  })
  @ApiResponse({ status: 200, description: 'Token minted', type: Object })
  getToken(@CurrentUser() authUser: AuthenticatedUser): { token: string } {
    return { token: this.wdkAppNodeService.mintToken(authUser.email) };
  }

  @Get('token-transfers')
  @ApiOperation({
    summary:
      "Proxies app-node's token-transfers for the authenticated user, with a short server-side " +
      'retry and a 24h Redis fallback cache — app-node/ork DHT shard lookups can fail for ' +
      'minutes at a stretch, and this absorbs that instead of erroring on every request',
  })
  @ApiResponse({ status: 200, description: 'Token transfers', type: Object })
  async getTokenTransfers(
    @CurrentUser() authUser: AuthenticatedUser,
    @Query() query: TokenTransfersQueryDto,
  ): Promise<{ transfers: TokenTransfer[] }> {
    const transfers = await this.tokenTransfersService.getTokenTransfers(authUser.email, query);
    return { transfers };
  }
}
