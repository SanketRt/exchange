import { MarketMaker, MomentumTrader, MeanReversionTrader, LiquidityTaker, FlashCrashTrader } from './tradingAgents';

async function startTradingAgents() {
  console.log('===========================================');
  console.log('Starting realistic trading simulation...');
  console.log('===========================================');

  // Create and start market maker
  console.log('✓ Initializing market maker...');
  const marketMaker = new MarketMaker();
  await marketMaker.start();
  console.log('✓ Market maker started successfully');

  // Wait for market maker to establish initial prices
  console.log('> Waiting for market maker to establish prices...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Create and start momentum trader
  console.log('✓ Initializing momentum trader...');
  const momentumTrader = new MomentumTrader();
  await momentumTrader.start();
  console.log('✓ Momentum trader started successfully');

  // Create and start mean reversion trader
  console.log('✓ Initializing mean reversion trader...');
  const meanReversionTrader = new MeanReversionTrader();
  await meanReversionTrader.start();
  console.log('✓ Mean reversion trader started successfully');

  // Create and start liquidity taker
  console.log('✓ Initializing liquidity taker...');
  const liquidityTaker = new LiquidityTaker();
  await liquidityTaker.start();
  console.log('✓ Liquidity taker started successfully');

  // Create and start flash crash trader
  console.log('✓ Initializing flash crash trader...');
  const flashCrashTrader = new FlashCrashTrader();
  await flashCrashTrader.start();
  console.log('✓ Flash crash trader started successfully');

  console.log('===========================================');
  console.log('All trading agents are running!');
  console.log('Dynamic market simulation is now active.');
  console.log('Realistic trading patterns will emerge from agent interaction.');
  console.log('===========================================');
}

startTradingAgents().catch(error => {
  console.error('Error starting trading agents:', error);
}); 