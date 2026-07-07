import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness check for the load balancer — no auth required' })
  @ApiOkResponse({ description: 'Service is up' })
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
