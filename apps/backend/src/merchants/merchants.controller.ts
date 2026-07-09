import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { MerchantsResponseDto } from './dto/merchants-response.dto';

@ApiTags('merchants')
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get()
  @ApiOperation({ summary: 'List affiliated merchant addresses and the current cashback rate — no auth required' })
  @ApiOkResponse({ type: MerchantsResponseDto })
  list(): MerchantsResponseDto {
    return this.merchantsService.getMerchants();
  }
}
