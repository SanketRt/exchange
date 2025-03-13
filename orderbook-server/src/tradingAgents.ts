import axios from 'axios';
import { OrderInput } from './types';

const API_URL = 'http://localhost:3000/api';

// Helper function to add random noise to a value
function addNoise(value: number, noisePercent: number): number {
  const noise = (Math.random() - 0.5) * 2 * (value * noisePercent);
  return value + noise;
}

// Global market state that agents can react to
const marketState = {
  trend: 0, // Current market trend (-1 to 1)
  volatility: 0.01, // Current market volatility
  lastPrice: 50000, // Last traded price
  tradeCount: 0, // Number of trades executed
  priceHistory: [] as number[], // Keep track of recent prices
  newsEvents: [] as {type: string, impact: number, timestamp: number}[], // Market news/events
  updateTrend(newPrice: number): void {
    // Store price history (keep last 100 prices)
    this.priceHistory.push(newPrice);
    if (this.priceHistory.length > 100) {
      this.priceHistory.shift();
    }
    
    if (this.lastPrice) {
      const change = (newPrice - this.lastPrice) / this.lastPrice;
      // Exponential moving average of trend
      this.trend = this.trend * 0.95 + change * 20;
      // Bound trend between -1 and 1
      this.trend = Math.max(-1, Math.min(1, this.trend));
      
      // Update volatility (simple volatility measure)
      this.volatility = this.volatility * 0.9 + Math.abs(change) * 10;
      this.volatility = Math.max(0.005, Math.min(0.05, this.volatility));
    }
    this.lastPrice = newPrice;
  },
  // Add a market news event
  addNewsEvent(type: string, impact: number) {
    const event = {
      type,
      impact, // -1 to 1 (negative to positive)
      timestamp: Date.now()
    };
    this.newsEvents.push(event);
    
    // Keep only recent events (last 5)
    if (this.newsEvents.length > 5) {
      this.newsEvents.shift();
    }
    
    console.log(`MARKET NEWS: ${type} (Impact: ${impact > 0 ? '+' : ''}${impact.toFixed(2)})`);
    
    // News directly affects the trend
    this.trend = this.trend * 0.7 + impact * 0.3;
    
    // Significant news increases volatility temporarily
    this.volatility = Math.min(0.05, this.volatility + Math.abs(impact) * 0.01);
  },
  // Get current market sentiment based on trend, volatility, and news
  getSentiment(): number {
    // Base sentiment from trend
    let sentiment = this.trend;
    
    // Recent news affects sentiment (with time decay)
    const now = Date.now();
    for (const event of this.newsEvents) {
      // News from the last 30 seconds has an effect
      const age = (now - event.timestamp) / 1000;
      if (age < 30) {
        const impact = event.impact * (1 - age/30); // Decay with time
        sentiment += impact * 0.2; // News has 20% weight in sentiment
      }
    }
    
    // Bound between -1 and 1
    return Math.max(-1, Math.min(1, sentiment));
  }
};

// Occasionally generate random market news
function startNewsGenerator() {
  const generateNews = () => {
    // 30% chance of news every 15-45 seconds
    if (Math.random() < 0.3) {
      const newsTypes = [
        { type: "Regulatory announcement", maxImpact: 0.8 },
        { type: "Technical development", maxImpact: 0.6 },
        { type: "Trading volume spike", maxImpact: 0.4 },
        { type: "Whale movement detected", maxImpact: 0.7 },
        { type: "Market sentiment shift", maxImpact: 0.5 }
      ];
      
      const selected = newsTypes[Math.floor(Math.random() * newsTypes.length)];
      const direction = Math.random() > 0.5 ? 1 : -1;
      const impact = direction * (0.2 + Math.random() * selected.maxImpact);
      
      marketState.addNewsEvent(selected.type, impact);
    }
    
    // Schedule next news check
    const delay = 15000 + Math.random() * 30000; // 15-45 seconds
    setTimeout(generateNews, delay);
  };
  
  generateNews();
}

// Start the news generator
startNewsGenerator();

class TradingAgent {
  private baseAsset: string = 'BTC';
  private quoteAsset: string = 'USD';
  private balance: { [key: string]: number } = { BTC: 100, USD: 1000000 };
  protected lastOrderTime: number = 0;
  protected tradeHistory: any[] = [];

  constructor(private name: string, private strategy: string) {}

  protected async getMarketData() {
    try {
      const { data } = await axios.get(`${API_URL}/market/summary`);
      
      // Update global market state
      if (data.bestBid && data.bestAsk) {
        const midPrice = (data.bestBid.price + data.bestAsk.price) / 2;
        marketState.updateTrend(midPrice);
      }
      
      return data;
    } catch (error) {
      console.error(`Error fetching market data: ${error}`);
      return {};
    }
  }

  protected async placeOrder(order: OrderInput) {
    try {
      const { data } = await axios.post(`${API_URL}/orders`, order);
      console.log(`${this.name} placed ${order.side} order at $${order.price} for ${order.quantity} BTC`);
      
      // If order was filled or partially filled, increment trade count
      if (data.fills && data.fills.length > 0) {
        marketState.tradeCount += data.fills.length;
        console.log(`${this.name} order filled! ${data.fills.length} trades executed.`);
      }
      
      // Keep track of order
      this.tradeHistory.push({
        ...order,
        timestamp: Date.now(),
        result: data
      });
      
      // Limit trade history size
      if (this.tradeHistory.length > 20) {
        this.tradeHistory.shift();
      }
      
      this.lastOrderTime = Date.now();
      return data;
    } catch (error) {
      console.error(`${this.name} order error:`, error);
    }
  }
  
  // Calculate how long to wait until next order (throttling mechanism)
  protected getOrderDelay(): number {
    // Base delay
    const baseDelay = 1000;
    
    // Add randomness
    const randomFactor = Math.random() * 2000;
    
    // Adjust based on volatility - more volatile means quicker responses
    const volatilityFactor = (1 - Math.min(1, marketState.volatility * 10)) * 3000;
    
    return baseDelay + randomFactor + volatilityFactor;
  }
}

// Market Maker: Creates liquidity around current price
export class MarketMaker extends TradingAgent {
  private baseSpreadPercentage = 0.002; // 0.2% base spread
  private lastMid: number | null = null;
  private volatilityAdjustment = 1.0;
  private lastOrderId: string | null = null;

  constructor() {
    super('MarketMaker', 'spread');
  }

  private updateVolatility(currentMid: number) {
    if (this.lastMid) {
      const change = Math.abs((currentMid - this.lastMid) / this.lastMid);
      // Increase spread when volatility is high
      this.volatilityAdjustment = Math.min(5, Math.max(1, 1 + change * 200));
    }
    this.lastMid = currentMid;
  }

  async start() {
    const placeMakerOrders = async () => {
      try {
        const market = await this.getMarketData();
        
        if (!market.bestBid || !market.bestAsk) {
          // Initialize market with a reference price
          const refPrice = addNoise(50000, 0.001);
          const spread = refPrice * this.baseSpreadPercentage;
          
          await this.placeOrder({
            baseAsset: 'BTC',
            quoteAsset: 'USD',
            price: refPrice - spread/2,
            quantity: addNoise(0.2, 0.2),
            side: 'buy',
            type: 'limit',
            kind: 'gtc'
          });
          
          await this.placeOrder({
            baseAsset: 'BTC',
            quoteAsset: 'USD',
            price: refPrice + spread/2,
            quantity: addNoise(0.2, 0.2),
            side: 'sell',
            type: 'limit',
            kind: 'gtc'
          });
        } else {
          const mid = (market.bestBid.price + market.bestAsk.price) / 2;
          this.updateVolatility(mid);
          
          // Adjust spread based on current volatility
          const dynamicSpread = this.baseSpreadPercentage * 
                              this.volatilityAdjustment * 
                              (1 + marketState.volatility * 20);
          
          const spread = mid * dynamicSpread;
          
          // Randomize order sizes - larger when volatility is high
          const baseQuantity = 0.1 * (1 + (this.volatilityAdjustment - 1) * 0.5);
          
          // Sometimes skew the spread to move the market
          const skewFactor = (Math.random() > 0.7) ? 
                             (Math.random() - 0.5) * 0.3 : 0;
          
          // Adjust skew based on market sentiment
          const sentimentSkew = marketState.getSentiment() * 0.1;
          
          await this.placeOrder({
            baseAsset: 'BTC',
            quoteAsset: 'USD',
            price: mid - spread/2 * (1 + skewFactor + sentimentSkew),
            quantity: addNoise(baseQuantity, 0.3),
            side: 'buy',
            type: 'limit',
            kind: 'gtc'
          });
          
          await this.placeOrder({
            baseAsset: 'BTC',
            quoteAsset: 'USD',
            price: mid + spread/2 * (1 - skewFactor + sentimentSkew),
            quantity: addNoise(baseQuantity, 0.3),
            side: 'sell',
            type: 'limit',
            kind: 'gtc'
          });
        }
      } catch (error) {
        console.error('Market maker error:', error);
      }
      
      // Schedule next order
      setTimeout(placeMakerOrders, this.getOrderDelay() * 0.7); // Market makers move faster
    };
    
    // Start the trading loop
    placeMakerOrders();
  }
}

// Momentum Trader: Follows market trends
export class MomentumTrader extends TradingAgent {
  private lastPrice: number | null = null;
  private baseThreshold = 0.001; // 0.1% base threshold
  private consecutiveMoves = 0;
  private maxConsecutiveTrades = 5;
  private trendsDetected = 0;

  constructor() {
    super('MomentumTrader', 'momentum');
  }

  async start() {
    const placeOrder = async () => {
      try {
        const market = await this.getMarketData();
        if (!market.bestBid || !market.bestAsk) return;

        const currentPrice = (market.bestBid.price + market.bestAsk.price) / 2;
        
        if (this.lastPrice) {
          // Check if we're in a trend using global market state
          const trendStrength = Math.abs(marketState.trend);
          const trendDirection = Math.sign(marketState.trend);
          
          // Get market sentiment influence
          const sentiment = marketState.getSentiment();
          const sentimentInfluence = Math.abs(sentiment) > 0.3 ? sentiment : 0;
          
          // Only trade when trend is strong enough or sentiment is strong
          if (trendStrength > 0.1 || Math.abs(sentimentInfluence) > 0.3) {
            // Calculate dynamic threshold based on market conditions
            const dynamicThreshold = this.baseThreshold * 
                                   (1 + this.consecutiveMoves * 0.3) * 
                                   (1 / (trendStrength + 0.5)); // Lower threshold when trend is strong
            
            const priceChange = (currentPrice - this.lastPrice) / this.lastPrice;
            
            // Trade in direction of trend if price is moving meaningfully
            if (Math.abs(priceChange) > dynamicThreshold) {
              // Use either trend direction or sentiment, whichever is stronger
              const direction = Math.abs(sentimentInfluence) > trendStrength ? 
                              Math.sign(sentiment) : trendDirection;
              
              const side = direction > 0 ? 'buy' : 'sell';
              
              // Scale position with trend strength and sentiment
              const quantity = 0.2 * (1 + Math.max(trendStrength, Math.abs(sentimentInfluence)) * 3);
              
              if (this.consecutiveMoves < this.maxConsecutiveTrades) {
                // Use market price (bestAsk for buys, bestBid for sells)
                const price = side === 'buy' ? market.bestAsk.price : market.bestBid.price;
                
                await this.placeOrder({
                  baseAsset: 'BTC',
                  quoteAsset: 'USD',
                  price,
                  quantity: addNoise(quantity, 0.2),
                  side,
                  type: 'limit',
                  kind: 'ioc' // Immediate-or-cancel to ensure it acts like a market order
                });
                
                this.consecutiveMoves++;
                this.trendsDetected++;
              } else if (Math.random() > 0.5) { // More aggressive profit taking (50% chance)
                // Occasionally, reverse position to take profits
                const reverseSide = side === 'buy' ? 'sell' : 'buy';
                const price = reverseSide === 'buy' ? market.bestAsk.price : market.bestBid.price;
                
                await this.placeOrder({
                  baseAsset: 'BTC',
                  quoteAsset: 'USD',
                  price,
                  quantity: addNoise(quantity * 0.7, 0.1), // More aggressive position size
                  side: reverseSide,
                  type: 'limit',
                  kind: 'ioc'
                });
                
                this.consecutiveMoves = 0;
              }
            } else if (Math.random() > 0.8) { // Increased probability to reset streak
              // Occasionally reset streak to avoid excessive trading
              this.consecutiveMoves = 0;
            }
          } else {
            // In choppy markets, occasionally make random trades
            if (Math.random() > 0.8) { // Increased probability of random trades
              const side = Math.random() > 0.5 ? 'buy' : 'sell';
              const price = side === 'buy' ? market.bestAsk.price : market.bestBid.price;
              
              await this.placeOrder({
                baseAsset: 'BTC',
                quoteAsset: 'USD',
                price,
                quantity: addNoise(0.05, 0.3),
                side,
                type: 'limit',
                kind: 'ioc'
              });
            }
          }
        }
        
        this.lastPrice = currentPrice;
      } catch (error) {
        console.error('Momentum trader error:', error);
      }
      
      // Schedule next order - move faster in high volatility
      setTimeout(placeOrder, this.getOrderDelay() * (1 - marketState.volatility * 10));
    };
    
    // Start the trading loop
    placeOrder();
  }
}

// Mean Reversion Trader: Trades against extreme movements
export class MeanReversionTrader extends TradingAgent {
  private prices: number[] = [];
  private baseWindowSize = 20;
  private baseDeviationThreshold = 0.015; // Reduced to 1.5% from 2%
  private lastTradePrice: number | null = null;
  private overextendedCount = 0;

  constructor() {
    super('MeanReversionTrader', 'mean-reversion');
  }

  private calculateMA() {
    if (this.prices.length < this.baseWindowSize) return null;
    
    // Dynamic window size based on volatility
    const dynamicWindow = Math.max(
      5, 
      Math.floor(this.baseWindowSize * (1 - marketState.volatility * 5))
    );
    
    const windowSize = Math.min(dynamicWindow, this.prices.length);
    const sum = this.prices.slice(-windowSize).reduce((a, b) => a + b, 0);
    return sum / windowSize;
  }

  private calculateVolatility() {
    if (this.prices.length < this.baseWindowSize) return 1;
    const ma = this.calculateMA();
    if (!ma) return 1;
    
    const variance = this.prices.slice(-this.baseWindowSize)
      .reduce((sum, price) => sum + Math.pow(price - ma, 2), 0) / this.baseWindowSize;
    return Math.sqrt(variance) / ma;
  }
  
  // Check for overextended markets
  private isOverextended(currentPrice: number, ma: number) {
    const percentFromMA = Math.abs((currentPrice - ma) / ma);
    
    // If price is very far from MA, count it as overextended - lowered threshold
    if (percentFromMA > 0.02) { // Reduced from 0.03
      this.overextendedCount++;
      return this.overextendedCount > 1; // Reduced confirmation count from 2 to 1
    } else {
      this.overextendedCount = 0;
      return false;
    }
  }

  async start() {
    const placeOrder = async () => {
      try {
        const market = await this.getMarketData();
        if (!market.bestBid || !market.bestAsk) return;

        const currentPrice = (market.bestBid.price + market.bestAsk.price) / 2;
        this.prices.push(currentPrice);

        // Limit the price history size
        if (this.prices.length > 100) {
          this.prices.shift();
        }

        const ma = this.calculateMA();
        if (ma) {
          const volatility = this.calculateVolatility();
          
          // Make threshold more aggressive when volatility is high
          const dynamicThreshold = this.baseDeviationThreshold * 
                                  (1 - marketState.volatility * 5);
          
          const deviation = (currentPrice - ma) / ma;
          
          // More likely to trade when price deviates significantly
          const tradeThreshold = Math.max(0.005, dynamicThreshold * (1 - Math.abs(deviation) * 2));
          
          if (Math.abs(deviation) > tradeThreshold || this.isOverextended(currentPrice, ma)) {
            const side = deviation > 0 ? 'sell' : 'buy';
            
            // Scale position size with deviation magnitude - larger positions when further from mean
            const quantity = 0.1 * (1 + Math.abs(deviation) * 15); // Increased multiplier
            
            // Check if we've moved far enough from last trade - reduced threshold
            const canTrade = !this.lastTradePrice || 
                           Math.abs((currentPrice - this.lastTradePrice) / this.lastTradePrice) > 0.003; // Reduced from 0.005
            
            if (canTrade) {
              // Use market price (bestAsk for buys, bestBid for sells)
              const price = side === 'buy' ? market.bestAsk.price : market.bestBid.price;
              
              await this.placeOrder({
                baseAsset: 'BTC',
                quoteAsset: 'USD',
                price,
                quantity: addNoise(quantity, 0.2),
                side,
                type: 'limit',
                kind: 'ioc' // Ensure immediate execution
              });
              
              this.lastTradePrice = currentPrice;
            }
          }
        }
      } catch (error) {
        console.error('Mean reversion trader error:', error);
      }
      
      // Schedule next order - more active in high volatility
      setTimeout(placeOrder, this.getOrderDelay() * (1 - marketState.volatility * 10)); // Increased volatility effect
    };
    
    // Start the trading loop
    placeOrder();
  }
}

// Liquidity Taker: Aggressively crosses the spread at random intervals
export class LiquidityTaker extends TradingAgent {
  private takerChance = 0.7; // Increased from 0.4 to 0.7 (70% chance)
  private burstMode = false;
  private burstEndTime = 0;
  
  constructor() {
    super('LiquidityTaker', 'taker');
  }
  
  async start() {
    const takeOrder = async () => {
      try {
        const market = await this.getMarketData();
        if (!market.bestBid || !market.bestAsk) return;
        
        // Check if we should enter burst mode (simulates aggressive trading)
        if (!this.burstMode && Math.random() > 0.9) {
          this.burstMode = true;
          this.burstEndTime = Date.now() + (3000 + Math.random() * 7000); // 3-10 seconds of burst
          console.log('LiquidityTaker entering BURST MODE for aggressive trading!');
        }
        
        // Exit burst mode if time's up
        if (this.burstMode && Date.now() > this.burstEndTime) {
          this.burstMode = false;
          console.log('LiquidityTaker exiting burst mode');
        }
        
        // Always take liquidity in burst mode, otherwise use takerChance
        if (this.burstMode || Math.random() < this.takerChance) {
          // In burst mode, we might place multiple orders
          const orderCount = this.burstMode ? (1 + Math.floor(Math.random() * 3)) : 1;
          
          for (let i = 0; i < orderCount; i++) {
            // Bias toward market trend in burst mode
            let side: 'buy' | 'sell';
            if (this.burstMode && Math.abs(marketState.trend) > 0.2) {
              // 80% chance to follow trend, 20% against
              side = Math.random() < 0.8 ? 
                (marketState.trend > 0 ? 'buy' : 'sell') : 
                (marketState.trend > 0 ? 'sell' : 'buy');
            } else {
              // Random side otherwise
              side = Math.random() > 0.5 ? 'buy' : 'sell';
            }
            
            // Take the opposing side of the book (use exact price from order book)
            const price = side === 'buy' ? market.bestAsk.price : market.bestBid.price;
            
            // Random size, larger during high volatility and in burst mode
            const baseSize = 0.05 + Math.random() * 0.3; // Increased max size
            const volatilityMultiplier = 1 + marketState.volatility * 15; // Increased effect
            const burstMultiplier = this.burstMode ? (1.5 + Math.random()) : 1;
            const size = baseSize * volatilityMultiplier * burstMultiplier;
            
            await this.placeOrder({
              baseAsset: 'BTC',
              quoteAsset: 'USD',
              price,
              quantity: addNoise(size, 0.3),
              side,
              type: 'limit',
              kind: 'ioc' // Immediate-or-cancel for market-like behavior
            });
            
            // Small delay between burst orders
            if (this.burstMode && i < orderCount - 1) {
              await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
            }
          }
        }
      } catch (error) {
        console.error('Liquidity taker error:', error);
      }
      
      // Schedule next check - much faster in burst mode or high volatility
      const baseDelay = this.burstMode ? 500 : addNoise(2000, 0.5); // Reduced from 3000
      const volatilityFactor = Math.max(0.1, 1 - marketState.volatility * 15); // Increased effect
      const adjustedDelay = baseDelay * volatilityFactor;
      setTimeout(takeOrder, Math.max(200, adjustedDelay)); // Reduced minimum delay
    };
    
    // Start the trading loop
    takeOrder();
  }
}

// Flash Crash Trader: Occasionally creates high-volume sell-offs
export class FlashCrashTrader extends TradingAgent {
  private crashProbability = 0.01; // 1% chance per check
  private lastCrashTime = 0;
  private minCrashInterval = 60000 * 5; // At least 5 minutes between crashes
  
  constructor() {
    super('FlashCrashTrader', 'flash');
  }
  
  async start() {
    const checkForCrash = async () => {
      try {
        // Only consider a crash if enough time has passed since the last one
        const timeSinceLastCrash = Date.now() - this.lastCrashTime;
        
        if (timeSinceLastCrash > this.minCrashInterval && Math.random() < this.crashProbability) {
          console.log('FLASH CRASH INCOMING: High volume selling about to occur!');
          
          const market = await this.getMarketData();
          if (!market.bestBid || !market.bestAsk) return;
          
          // Number of sell orders to place in rapid succession
          const orderCount = 3 + Math.floor(Math.random() * 5); // 3-7 orders
          
          for (let i = 0; i < orderCount; i++) {
            // Progressively lower prices
            const initialPrice = market.bestBid.price * 0.998; // Start slightly below best bid
            const priceDecay = 0.997 - (Math.random() * 0.004); // 0.3-0.7% decay per order
            const price = initialPrice * Math.pow(priceDecay, i);
            
            // Larger size orders
            const size = 0.2 + Math.random() * 0.5;
            
            await this.placeOrder({
              baseAsset: 'BTC',
              quoteAsset: 'USD',
              price,
              quantity: addNoise(size, 0.1),
              side: 'sell',
              type: 'limit',
              kind: 'ioc'
            });
            
            // Short delay between orders
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));
          }
          
          this.lastCrashTime = Date.now();
          console.log('Flash crash orders completed');
          
          // After a crash, generate a "market reaction" news event
          setTimeout(() => {
            if (Math.random() > 0.5) {
              marketState.addNewsEvent("Market reaction to selloff", Math.random() * 0.6 - 0.3);
            }
          }, 2000 + Math.random() * 3000);
        }
      } catch (error) {
        console.error('Flash crash trader error:', error);
      }
      
      // Schedule next check
      setTimeout(checkForCrash, 10000 + Math.random() * 20000); // 10-30 seconds between checks
    };
    
    // Start the check loop
    checkForCrash();
  }
} 