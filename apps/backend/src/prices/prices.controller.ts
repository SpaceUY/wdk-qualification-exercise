import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PricesService } from './prices.service';
import { PricesResponseDto } from './dto/prices-response.dto';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';
import { PriceHistoryResponseDto } from './dto/price-history-response.dto';

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

  @Get('history/:symbol')
  @ApiOperation({ summary: 'USD price series for one asset over a range — public market data, no auth required' })
  @ApiParam({ name: 'symbol', example: 'BTC', description: 'Asset symbol as displayed by the wallet' })
  @ApiOkResponse({ type: PriceHistoryResponseDto })
  @ApiNotFoundResponse({ description: 'Unknown asset symbol' })
  history(@Param('symbol') symbol: string, @Query() query: PriceHistoryQueryDto): Promise<PriceHistoryResponseDto> {
    return this.pricesService.getPriceHistory(symbol, query.range);
  }
}
