import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { WdkAppNodeService } from './wdk-app-node.service';

@ApiTags('wdk-app-node')
@ApiBearerAuth('access-token')
@Controller('wdk-app-node')
@UseGuards(JwtAuthGuard)
export class WdkAppNodeController {
  constructor(private readonly wdkAppNodeService: WdkAppNodeService) {}

  @Get('token')
  @ApiOperation({
    summary:
      "Mint a short-lived JWT for the self-hosted WDK app-node API, scoped to the authenticated user's wallet id (their Cognito email)",
  })
  @ApiResponse({ status: 200, description: 'Token minted', type: Object })
  getToken(@CurrentUser() authUser: AuthenticatedUser): { token: string } {
    return { token: this.wdkAppNodeService.mintToken(authUser.email) };
  }
}
