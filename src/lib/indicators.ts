/**
 * Technical Indicators Library
 * Implements various trading indicators including Supertrend
 */

export interface OHLCData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: string;
}

export interface SupertrendResult {
  value: number;
  direction: 'up' | 'down';
  signal: 'buy' | 'sell' | 'hold';
  atr: number;
  basicUpperBand: number;
  basicLowerBand: number;
}

export interface SupertrendConfig {
  atrPeriod: number;
  factor: number;
}

/**
 * Calculate True Range for a single period
 */
function calculateTrueRange(current: OHLCData, previous?: OHLCData): number {
  if (!previous) {
    return current.high - current.low;
  }

  const tr1 = current.high - current.low;
  const tr2 = Math.abs(current.high - previous.close);
  const tr3 = Math.abs(current.low - previous.close);

  return Math.max(tr1, tr2, tr3);
}

/**
 * Calculate Average True Range (ATR)
 */
export function calculateATR(ohlcData: OHLCData[], period: number = 14): number[] {
  if (ohlcData.length < period) {
    throw new Error(`Insufficient data for ATR calculation. Need at least ${period} periods, got ${ohlcData.length}`);
  }

  const atrValues: number[] = [];
  const trueRanges: number[] = [];

  // Calculate True Range for each period
  for (let i = 0; i < ohlcData.length; i++) {
    const current = ohlcData[i];
    const previous = i > 0 ? ohlcData[i - 1] : undefined;
    trueRanges.push(calculateTrueRange(current, previous));
  }

  // Calculate initial ATR using Simple Moving Average
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trueRanges[i];
  }
  atrValues.push(sum / period);

  // Calculate subsequent ATR values using Wilder's smoothing method
  // ATR = ((Previous ATR * (period - 1)) + Current TR) / period
  for (let i = period; i < trueRanges.length; i++) {
    const previousATR = atrValues[atrValues.length - 1];
    const currentTR = trueRanges[i];
    const newATR = ((previousATR * (period - 1)) + currentTR) / period;
    atrValues.push(newATR);
  }

  return atrValues;
}

/**
 * Calculate Supertrend Indicator
 * Based on TradingView's Pine Script implementation
 */
export function calculateSupertrend(
  ohlcData: OHLCData[], 
  config: SupertrendConfig = { atrPeriod: 10, factor: 3.0 }
): SupertrendResult[] {
  const { atrPeriod, factor } = config;

  if (ohlcData.length < atrPeriod + 1) {
    throw new Error(`Insufficient data for Supertrend calculation. Need at least ${atrPeriod + 1} periods, got ${ohlcData.length}`);
  }

  // Calculate ATR
  const atrValues = calculateATR(ohlcData, atrPeriod);
  const results: SupertrendResult[] = [];

  // We start from the ATR period index since we need ATR values
  for (let i = atrPeriod - 1; i < ohlcData.length; i++) {
    const current = ohlcData[i];
    const atrIndex = i - (atrPeriod - 1);
    const currentATR = atrValues[atrIndex];

    // Calculate HL2 (typical price)
    const hl2 = (current.high + current.low) / 2;

    // Calculate basic upper and lower bands
    const basicUpperBand = hl2 + (factor * currentATR);
    const basicLowerBand = hl2 - (factor * currentATR);

    let finalUpperBand = basicUpperBand;
    let finalLowerBand = basicLowerBand;

    // Apply band calculation rules
    if (i > atrPeriod - 1) {
      const previousResult = results[results.length - 1];
      const previousClose = ohlcData[i - 1].close;

      // Final Upper Band calculation
      if (basicUpperBand < previousResult.basicUpperBand || previousClose > previousResult.basicUpperBand) {
        finalUpperBand = basicUpperBand;
      } else {
        finalUpperBand = previousResult.basicUpperBand;
      }

      // Final Lower Band calculation
      if (basicLowerBand > previousResult.basicLowerBand || previousClose < previousResult.basicLowerBand) {
        finalLowerBand = basicLowerBand;
      } else {
        finalLowerBand = previousResult.basicLowerBand;
      }
    }

    // Determine Supertrend direction and value
    let supertrendValue: number;
    let direction: 'up' | 'down';
    let signal: 'buy' | 'sell' | 'hold' = 'hold';

    if (i === atrPeriod - 1) {
      // First calculation
      direction = current.close <= finalLowerBand ? 'down' : 'up';
      supertrendValue = direction === 'up' ? finalLowerBand : finalUpperBand;
    } else {
      const previousResult = results[results.length - 1];
      const previousDirection = previousResult.direction;

      // Determine current direction
      if (previousDirection === 'up' && current.close > finalLowerBand) {
        direction = 'up';
        supertrendValue = finalLowerBand;
      } else if (previousDirection === 'up' && current.close <= finalLowerBand) {
        direction = 'down';
        supertrendValue = finalUpperBand;
        signal = 'sell'; // Trend changed from up to down
      } else if (previousDirection === 'down' && current.close < finalUpperBand) {
        direction = 'down';
        supertrendValue = finalUpperBand;
      } else if (previousDirection === 'down' && current.close >= finalUpperBand) {
        direction = 'up';
        supertrendValue = finalLowerBand;
        signal = 'buy'; // Trend changed from down to up
      } else {
        // Fallback
        direction = current.close > hl2 ? 'up' : 'down';
        supertrendValue = direction === 'up' ? finalLowerBand : finalUpperBand;
      }
    }

    results.push({
      value: supertrendValue,
      direction,
      signal,
      atr: currentATR,
      basicUpperBand: finalUpperBand,
      basicLowerBand: finalLowerBand
    });
  }

  return results;
}

/**
 * Get the latest Supertrend signal for an asset
 */
export function getLatestSupertrendSignal(ohlcData: OHLCData[], config?: SupertrendConfig): SupertrendResult | null {
  try {
    const results = calculateSupertrend(ohlcData, config);
    return results.length > 0 ? results[results.length - 1] : null;
  } catch (error) {
    console.error('Error calculating Supertrend:', error);
    return null;
  }
}

/**
 * Convert simple price data to OHLC format (for fallback scenarios)
 */
export function convertPricesToOHLC(prices: number[], dates?: string[]): OHLCData[] {
  return prices.map((price, index) => ({
    open: price,
    high: price * 1.01, // Estimate 1% higher for high
    low: price * 0.99,  // Estimate 1% lower for low
    close: price,
    volume: 1000000, // Default volume
    time: dates?.[index] || new Date(Date.now() - (prices.length - index) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }));
}

/**
 * Validate OHLC data integrity
 */
export function validateOHLCData(ohlcData: OHLCData[]): boolean {
  return ohlcData.every(candle => 
    candle.high >= candle.low &&
    candle.high >= candle.open &&
    candle.high >= candle.close &&
    candle.low <= candle.open &&
    candle.low <= candle.close &&
    candle.volume >= 0
  );
}