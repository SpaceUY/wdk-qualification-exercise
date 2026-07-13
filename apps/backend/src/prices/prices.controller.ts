import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PricesService } from './prices.service';
import { PricesResponseDto } from './dto/prices-response.dto';

@ApiTags('prices')
@Controller('prices')
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get()
  @ApiOperation({ summary: 'USD spot prices for the assets the wallet displays — public market data, no auth required' })
  @ApiOkResponse({ type: PricesResponseDto })
  list(): Promise<PricesResponseDto> {
    return this.pricesService.getPrices();
  }
}
