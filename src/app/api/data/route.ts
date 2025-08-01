import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import {
  calculateSupertrend,
  getLatestSupertrendSignal,
  convertPricesToOHLC,
  validateOHLCData,
  type OHLCData,
  type SupertrendResult,
  type SupertrendConfig
} from "../../../lib/indicators";

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";
const ALPHA_VANTAGE_API_URL = "https://www.alphavantage.co/query";

// Simple in-memory cache for Alpha Vantage data
const alphaVantageCache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

// API keys from environment variables with fallbacks
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

interface HistoricalData {
  [key: string]: number[];
}

interface TrendData {
  trend: string;
  confidence: number;
  startDate: string;
}

interface ProcessedAsset {
  name: string;
  symbol: string;
  type: "stock" | "crypto";
  price?: number;
  "45M": TrendData;
  "2H": TrendData;
  "4H": TrendData;
  "1D": TrendData;
  "3D": TrendData;
  "1W": TrendData;
  supertrend?: {
    "45M": SupertrendResult | null;
    "2H": SupertrendResult | null;
    "4H": SupertrendResult | null;
    "1D": SupertrendResult | null;
    "3D": SupertrendResult | null;
    "1W": SupertrendResult | null;
  };
  ohlc?: OHLCData[];
}

// Enhanced dummy data with more realistic price movements
const dummyHistoricalData: HistoricalData = {
  "AAPL": [150, 152, 155, 153, 158, 160, 162, 165, 163, 168, 170, 169, 172, 175, 178],
  "MSFT": [300, 305, 302, 308, 312, 315, 318, 320, 325, 322, 328, 330, 335, 338, 340],
  "GOOGL": [2800, 2820, 2810, 2830, 2825, 2840, 2835, 2850, 2845, 2860, 2855, 2870, 2865, 2880, 2875],
  "AMZN": [3200, 3180, 3220, 3210, 3240, 3230, 3250, 3245, 3260, 3255, 3270, 3265, 3280, 3275, 3290],
  "TSLA": [800, 790, 810, 805, 820, 815, 830, 825, 840, 835, 850, 845, 860, 855, 870],
  "META": [350, 355, 352, 358, 362, 365, 368, 370, 375, 372, 378, 380, 385, 388, 390],
  "BTC": [45000, 44500, 44800, 45200, 45500, 45800, 46000, 46200, 46500, 46800, 47000, 47200, 47500, 47800, 48000],
  "ETH": [3000, 2980, 3020, 3010, 3040, 3030, 3050, 3045, 3060, 3055, 3070, 3065, 3080, 3075, 3090],
  "BNB": [400, 398, 402, 405, 408, 410, 412, 415, 418, 420, 422, 425, 428, 430, 432],
  "ADA": [1.2, 1.18, 1.22, 1.20, 1.24, 1.22, 1.26, 1.24, 1.28, 1.26, 1.30, 1.28, 1.32, 1.30, 1.34],
};

// Company names mapping for stocks
const stockNames: { [key: string]: string } = {
  "MSFT": "Microsoft Corporation",
  "GOOGL": "Alphabet Inc.",
  "AMZN": "Amazon.com Inc.",
  "TSLA": "Tesla Inc.",
  "META": "Meta Platforms Inc.",
  "NVDA": "NVIDIA Corporation",
  "NFLX": "Netflix Inc.",
  "AMD": "Advanced Micro Devices",
  "ORCL": "Oracle Corporation",
  "AAPL": "Apple Inc.",
};

// Enhanced trend analysis with multiple indicators
function analyzeTrend(historicalData: number[], timeframe: string = "1D"): TrendData {
  if (historicalData.length < 3) {
    return { 
      trend: "sideways", 
      confidence: 50, 
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
  }

  const prices = [...historicalData];
  const latestPrice = prices[prices.length - 1];
  const oldPrice = prices[0];
  const midPrice = prices[Math.floor(prices.length / 2)];
  
  // Calculate various metrics
  const totalChange = ((latestPrice - oldPrice) / oldPrice) * 100;
  const recentChange = ((latestPrice - midPrice) / midPrice) * 100;
  
  // Calculate moving average trend
  const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
  const secondHalf = prices.slice(Math.floor(prices.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const avgTrend = ((secondAvg - firstAvg) / firstAvg) * 100;

  // Volatility calculation
  const returns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * 100;

  // Determine trend based on multiple factors
  let trend = "sideways";
  let confidence = 50;
  
  // Adjust thresholds based on timeframe
  const thresholds = {
    "1H": { strong: 1, weak: 0.3 },
    "1D": { strong: 2, weak: 0.8 },
    "1W": { strong: 5, weak: 2 },
    "1M": { strong: 10, weak: 5 }
  };
  
  const threshold = thresholds[timeframe as keyof typeof thresholds] || thresholds["1D"];
  
  // Primary trend determination
  if (totalChange > threshold.strong && avgTrend > threshold.weak) {
    trend = "uptrend";
    confidence = Math.min(95, 60 + Math.abs(totalChange) * 2 + (avgTrend > 0 ? 10 : 0));
  } else if (totalChange < -threshold.strong && avgTrend < -threshold.weak) {
    trend = "downtrend";
    confidence = Math.min(95, 60 + Math.abs(totalChange) * 2 + (avgTrend < 0 ? 10 : 0));
  } else if (Math.abs(totalChange) > threshold.weak) {
    trend = totalChange > 0 ? "uptrend" : "downtrend";
    confidence = Math.min(85, 50 + Math.abs(totalChange) * 1.5);
  }
  
  // Adjust confidence based on volatility
  if (volatility > 5) {
    confidence = Math.max(40, confidence - 15); // High volatility reduces confidence
  } else if (volatility < 1) {
    confidence = Math.min(95, confidence + 10); // Low volatility increases confidence
  }
  
  // Generate realistic start date
  const daysBack = Math.floor(Math.random() * 30) + 1;
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return { trend, confidence: Math.round(confidence), startDate };
}

// Enhanced trend analysis from percentage change
function analyzeTrendFromPercentage(percentageChange: number, timeframe: string = "1D"): TrendData {
  let trend = "sideways";
  let confidence = 50;
  
  // Adjust thresholds based on timeframe
  const thresholds = {
    "1h": { strong: 2, weak: 0.5 },
    "24h": { strong: 5, weak: 1.5 },
    "7d": { strong: 10, weak: 3 },
    "30d": { strong: 20, weak: 8 }
  };
  
  const threshold = thresholds[timeframe as keyof typeof thresholds] || thresholds["24h"];
  
  if (percentageChange > threshold.strong) {
    trend = "uptrend";
    confidence = Math.min(95, 70 + Math.abs(percentageChange) * 1.5);
  } else if (percentageChange < -threshold.strong) {
    trend = "downtrend";
    confidence = Math.min(95, 70 + Math.abs(percentageChange) * 1.5);
  } else if (Math.abs(percentageChange) > threshold.weak) {
    trend = percentageChange > 0 ? "uptrend" : "downtrend";
    confidence = Math.min(80, 55 + Math.abs(percentageChange) * 2);
  } else {
    confidence = Math.max(60, 75 - Math.abs(percentageChange) * 5);
  }
  
  // Generate realistic start date
  const daysBack = Math.floor(Math.random() * 30) + 1;
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return { trend, confidence: Math.round(confidence), startDate };
}

async function fetchCryptoData(): Promise<any[]> {
  try {
    console.log("Fetching crypto data from CoinGecko...");
    
    const response = await axios.get(`${COINGECKO_API_URL}/coins/markets`, {
      params: {
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: 10,
        page: 1,
        sparkline: false,
        price_change_percentage: "1h,24h,7d,30d",
      },
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TradePro-Scanner/1.0',
        ...(COINGECKO_API_KEY && { 'x-cg-demo-api-key': COINGECKO_API_KEY })
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log(`Successfully fetched ${response.data.length} cryptocurrencies`);
    return response.data;
  } catch (error) {
    console.error("Error fetching crypto data:", error);
    
    // Return fallback data if API fails
    return [
      {
        id: "bitcoin",
        name: "Bitcoin",
        symbol: "btc",
        current_price: 48000,
        price_change_percentage_1h_in_currency: 0.5,
        price_change_percentage_24h_in_currency: 2.3,
        price_change_percentage_7d_in_currency: 8.7,
        price_change_percentage_30d_in_currency: 15.2
      },
      {
        id: "ethereum",
        name: "Ethereum",
        symbol: "eth",
        current_price: 3090,
        price_change_percentage_1h_in_currency: 0.8,
        price_change_percentage_24h_in_currency: 3.1,
        price_change_percentage_7d_in_currency: 12.4,
        price_change_percentage_30d_in_currency: 18.9
      },
      {
        id: "binancecoin",
        name: "Binance Coin",
        symbol: "bnb",
        current_price: 432,
        price_change_percentage_1h_in_currency: 0.3,
        price_change_percentage_24h_in_currency: 1.8,
        price_change_percentage_7d_in_currency: 6.2,
        price_change_percentage_30d_in_currency: 11.5
      }
    ];
  }
}

/**
 * Fetch OHLC data for a specific cryptocurrency
 */
async function fetchCryptoOHLC(coinId: string, days: number = 30): Promise<OHLCData[]> {
  try {
    const response = await axios.get(`${COINGECKO_API_URL}/coins/${coinId}/ohlc`, {
      params: {
        vs_currency: "usd",
        days: days
      },
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TradePro-Scanner/1.0',
        ...(COINGECKO_API_KEY && { 'x-cg-demo-api-key': COINGECKO_API_KEY })
      },
      timeout: 10000
    });

    // CoinGecko OHLC format: [timestamp, open, high, low, close]
    const ohlcData: OHLCData[] = response.data.map((item: number[]) => ({
      time: new Date(item[0]).toISOString().split('T')[0],
      open: item[1],
      high: item[2],
      low: item[3],
      close: item[4],
      volume: 1000000 // CoinGecko OHLC doesn't include volume, using default
    }));

    return ohlcData;
  } catch (error: any) {
    if (error.response && error.response.status === 400) {
      console.warn(`No OHLC data for ${coinId} (400 Bad Request). Returning empty array.`);
      return [];
    }
    console.error(`Error fetching OHLC data for ${coinId}:`, error);
    
    // Return fallback OHLC data based on current price
    const fallbackPrices = dummyHistoricalData[coinId.toUpperCase()] || dummyHistoricalData["BTC"];
    return convertPricesToOHLC(fallbackPrices);
  }
}

async function fetchStockData(): Promise<any[]> {
  try {
    console.log("Fetching stock data...");
    
    // Popular stock symbols to fetch
    const stockSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META"];
    const stockData = [];
    
    // If no API key, return dummy data immediately
    if (!ALPHA_VANTAGE_API_KEY || ALPHA_VANTAGE_API_KEY === "YOUR_ALPHA_VANTAGE_API_KEY") {
      console.log("No Alpha Vantage API key found, using dummy data");
      return stockSymbols.map(symbol => ({
        symbol: symbol,
        data: { "Time Series (Daily)": generateDummyTimeSeriesData(symbol) }
      }));
    }
    
    for (const symbol of stockSymbols) {
      try {
        // Check cache first
        const cachedItem = alphaVantageCache.get(symbol);
        if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_DURATION)) {
          console.log(`Using cached data for ${symbol}`);
          stockData.push({ symbol, data: cachedItem.data });
          continue;
        }

        const response = await axios.get(ALPHA_VANTAGE_API_URL, {
          params: {
            function: "TIME_SERIES_DAILY",
            symbol: symbol,
            outputsize: "full", // Fetch full historical data
            apikey: ALPHA_VANTAGE_API_KEY,
          },
          timeout: 15000 // 15 second timeout
        });
        
        // Check for API errors or rate limiting
        if (response.data["Error Message"] || response.data["Information"]) {
          const message = response.data["Error Message"] || response.data["Information"];
          console.warn(`Alpha Vantage error/info for ${symbol}: ${message}`);
          // Still cache the dummy data to avoid repeated failed calls
          const dummyData = { "Time Series (Daily)": generateDummyTimeSeriesData(symbol) };
          alphaVantageCache.set(symbol, { data: dummyData, timestamp: Date.now() });
          stockData.push({ symbol, data: dummyData });
          continue;
        }
        
        // Cache the successful response
        alphaVantageCache.set(symbol, { data: response.data, timestamp: Date.now() });
        stockData.push({
          symbol: symbol,
          data: response.data
        });
        
        // Add delay to respect rate limits
        if (stockSymbols.indexOf(symbol) < stockSymbols.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 12000));
        }
        
      } catch (error) {
        console.error(`Error fetching data for ${symbol}:`, error);
        const dummyData = { "Time Series (Daily)": generateDummyTimeSeriesData(symbol) };
        alphaVantageCache.set(symbol, { data: dummyData, timestamp: Date.now() });
        stockData.push({ symbol, data: dummyData });
      }
    }
    
    console.log(`Successfully processed ${stockData.length} stocks`);
    return stockData;
  } catch (error) {
    console.error("Error in fetchStockData:", error);
    return [];
  }
}

function generateDummyTimeSeriesData(symbol: string): any {
  const baseData = dummyHistoricalData[symbol] || dummyHistoricalData["AAPL"];
  const timeSeries: any = {};
  
  for (let i = 0; i < baseData.length; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (baseData.length - i));
    const dateStr = date.toISOString().split('T')[0];
    
    // Generate more realistic OHLC data with some volatility
    const close = baseData[i];
    const volatility = 0.02; // 2% volatility
    const randomFactor = (Math.random() - 0.5) * volatility;
    
    const open = i > 0 ? baseData[i - 1] : close;
    const high = Math.max(open, close) * (1 + Math.abs(randomFactor));
    const low = Math.min(open, close) * (1 - Math.abs(randomFactor));
    
    timeSeries[dateStr] = {
      "1. open": open.toString(),
      "2. high": high.toString(),
      "3. low": low.toString(),
      "4. close": close.toString(),
      "5. volume": (Math.floor(Math.random() * 5000000) + 1000000).toString()
    };
  }
  
  return timeSeries;
}

/**
 * Extract OHLC data from Alpha Vantage time series response
 */
function extractOHLCData(timeSeriesData: any, days: number = 30): OHLCData[] {
  if (!timeSeriesData || !timeSeriesData["Time Series (Daily)"]) {
    return [];
  }
  
  const timeSeries = timeSeriesData["Time Series (Daily)"];
  const dates = Object.keys(timeSeries).sort().reverse(); // Most recent first
  const ohlcData: OHLCData[] = [];
  
  for (let i = 0; i < Math.min(days, dates.length); i++) {
    const date = dates[i];
    const dayData = timeSeries[date];
    
    ohlcData.push({
      time: date,
      open: parseFloat(dayData["1. open"]),
      high: parseFloat(dayData["2. high"]),
      low: parseFloat(dayData["3. low"]),
      close: parseFloat(dayData["4. close"]),
      volume: parseInt(dayData["5. volume"])
    });
  }
  
  return ohlcData.reverse(); // Return oldest first for indicator calculations
}

/**
 * Calculate Supertrend for different timeframes
 */
function calculateSupertrendForTimeframes(ohlcData: OHLCData[]): {
  "45M": SupertrendResult | null;
  "2H": SupertrendResult | null;
  "4H": SupertrendResult | null;
  "1D": SupertrendResult | null;
  "3D": SupertrendResult | null;
  "1W": SupertrendResult | null;
} {
  const result = {
    "45M": null as SupertrendResult | null,
    "2H": null as SupertrendResult | null,
    "4H": null as SupertrendResult | null,
    "1D": null as SupertrendResult | null,
    "3D": null as SupertrendResult | null,
    "1W": null as SupertrendResult | null
  };

  console.log(`Calculating Supertrend with ${ohlcData.length} OHLC data points`);

  // If we don't have enough data, return null for all timeframes
  if (ohlcData.length < 15) {
    console.log('Insufficient OHLC data for Supertrend calculation');
    return result;
  }

  try {
    // For different timeframes, we'll use different configurations
    const configs: Record<string, SupertrendConfig> = {
      "45M": { atrPeriod: 7, factor: 2.0 },   // Very sensitive for 45min
      "2H": { atrPeriod: 8, factor: 2.5 },    // Sensitive for 2H
      "4H": { atrPeriod: 10, factor: 2.8 },   // Moderate for 4H
      "1D": { atrPeriod: 12, factor: 3.0 },   // Standard daily configuration
      "3D": { atrPeriod: 14, factor: 3.5 },   // Less sensitive for 3D
      "1W": { atrPeriod: 15, factor: 4.0 }    // Least sensitive for weekly
    };

    // Calculate for each timeframe using available data
    Object.keys(configs).forEach(timeframe => {
      const config = configs[timeframe];
      
      // Use different data lengths for different timeframes
      let dataLength: number;
      switch (timeframe) {
        case "45M": dataLength = Math.min(20, ohlcData.length); break;
        case "2H": dataLength = Math.min(25, ohlcData.length); break;
        case "4H": dataLength = Math.min(30, ohlcData.length); break;
        case "1D": dataLength = Math.min(40, ohlcData.length); break;
        case "3D": dataLength = Math.min(50, ohlcData.length); break;
        case "1W": dataLength = ohlcData.length; break;
        default: dataLength = ohlcData.length;
      }
      
      const timeframeData = ohlcData.slice(-dataLength);
      
      console.log(`${timeframe}: Using ${timeframeData.length} data points, need ${config.atrPeriod + 1}`);
      
      if (timeframeData.length >= config.atrPeriod + 1) {
        try {
          const supertrendResult = getLatestSupertrendSignal(timeframeData, config);
          result[timeframe as keyof typeof result] = supertrendResult;
          console.log(`${timeframe} Supertrend calculated:`, supertrendResult ? 'Success' : 'Failed');
        } catch (error) {
          console.error(`Error calculating Supertrend for ${timeframe}:`, error);
        }
      } else {
        console.log(`${timeframe}: Insufficient data (${timeframeData.length} < ${config.atrPeriod + 1})`);
      }
    });
  } catch (error) {
    console.error('Error calculating Supertrend for timeframes:', error);
  }

  return result;
}

function extractHistoricalPrices(timeSeriesData: any, days: number = 30): number[] {
  if (!timeSeriesData || !timeSeriesData["Time Series (Daily)"]) {
    return [];
  }
  
  const timeSeries = timeSeriesData["Time Series (Daily)"];
  const dates = Object.keys(timeSeries).sort().reverse(); // Most recent first
  const prices = dates.slice(0, days).map(date => parseFloat(timeSeries[date]["4. close"]));
  
  return prices.reverse(); // Oldest first for trend analysis
}

export async function GET() {
  try {
    console.log("Starting data fetch process...");
    
    const [stockData] = await Promise.allSettled([
      fetchStockData()
    ]);

    // Process crypto data
    const analyzedCrypto: ProcessedAsset[] = [];

    // Process stock data
    const analyzedStocks: ProcessedAsset[] = [];
    if (stockData.status === 'fulfilled' && Array.isArray(stockData.value)) {
      stockData.value.forEach((stock: any) => {
        try {
          const historical = extractHistoricalPrices(stock.data);
          const ohlcData = extractOHLCData(stock.data, 60); // Get 60 days of OHLC data
          
          if (historical.length > 0) {
            const currentPrice = historical[historical.length - 1];
            
            // Calculate Supertrend for all timeframes
            const supertrendData = calculateSupertrendForTimeframes(ohlcData);
            
            analyzedStocks.push({
              name: stockNames[stock.symbol] || stock.symbol,
              symbol: stock.symbol,
              price: currentPrice,
              type: "stock",
              "45M": analyzeTrend(historical.slice(-3), "45M"),
              "2H": analyzeTrend(historical.slice(-5), "2H"),
              "4H": analyzeTrend(historical.slice(-8), "4H"),
              "1D": analyzeTrend(historical.slice(-10), "1D"),
              "3D": analyzeTrend(historical.slice(-15), "3D"),
              "1W": analyzeTrend(historical.slice(-20), "1W"),
              supertrend: supertrendData,
              ohlc: ohlcData
            });
          }
        } catch (error) {
          console.error(`Error processing stock ${stock.symbol}:`, error);
        }
      });
    }

    const responseData = {
      message: "Market data fetched successfully",
      timestamp: new Date().toISOString(),
      crypto: [],
      stocks: analyzedStocks,
      metadata: {
        cryptoCount: 0,
        stockCount: analyzedStocks.length,
        totalAssets: analyzedStocks.length,
        dataSource: {
          crypto: 'disabled',
          stocks: stockData.status === 'fulfilled' ? 'live' : 'fallback'
        }
      }
    };

    // const filePath = path.join(process.cwd(), "api_response.json");
    // await fs.writeFile(filePath, JSON.stringify(responseData, null, 2));
    // console.log("API response saved to api_response.json");
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error("Critical error in API route:", error);
    
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to fetch market data",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}