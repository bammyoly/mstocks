// frontend/src/pages/Trade.jsx
import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Ticker,
  TICKER_NAMES,
  TICKER_SYMBOLS,
  OrderSide,
  LOGO_DOMAINS,
} from '../lib/privateState';
import { useLiveStockData } from '../hooks/useLiveStockData';
import StockChart from '../components/StockChart';
import { useWallet } from '../context/WalletContext';

const toContractPrice = (priceFloat) => BigInt(Math.floor(Number(priceFloat) * 100));

const StockIcon = ({ symbol, size = 'w-8 h-8' }) => {
  const domain = LOGO_DOMAINS?.[symbol] || `${symbol?.toLowerCase()}.com`;
  return (
    <div
      className={`${size} shrink-0 rounded-full bg-white border-2 border-white overflow-hidden relative flex items-center justify-center shadow-[2px_2px_0px_0px_#A855F7]`}
    >
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
        alt={symbol}
        className="w-full h-full object-contain p-1"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
  );
};

// 🟢 Reusable PnL Formatter
const PnLDisplay = ({ value, isPercent = false }) => {
  if (value === undefined || value === null || isNaN(value)) return <span className="text-zinc-500">--</span>;
  const isPositive = value >= 0;
  const prefix = isPositive ? '+' : '-';
  const formatted = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <span className={isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}>
      {prefix}{isPercent ? '' : '$'}{formatted}{isPercent ? '%' : ''}
    </span>
  );
};

const EmptyState = ({ title, subtitle }) => (
  <div className="w-full min-h-[160px] flex flex-col items-center justify-center text-center gap-2 opacity-70">
    <div className="text-sm font-black uppercase tracking-wide text-white">{title}</div>
    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{subtitle}</div>
  </div>
);

const BOTTOM_TABS = [
  { id: 'positions', label: 'Positions' },
  { id: 'orders', label: 'Orders' },
  { id: 'trades', label: 'Trades' },
  { id: 'logs', label: 'Logs' },
];

export default function Trade() {
  const {
    isConnected: isWalletConnected,
    connectWallet,
    contract,
    privateState,
    setPrivateState,
    usdcBalance,
    setUsdcBalance,
    isVerified,
    portfolioStats, // 🟢 Get stats from context
  } = useWallet();

  const { stockData, isConnected: isFeedConnected } = useLiveStockData();

  const [selectedTicker, setSelectedTicker] = useState(Ticker.AAPL);
  const [isBuy, setIsBuy] = useState(true);
  const [orderType, setOrderType] = useState('limit');
  const [price, setPrice] = useState('0');
  const [quantity, setQuantity] = useState('');
  const [isProving, setIsProving] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState('positions');
  const [logs, setLogs] = useState(['SYSTEM: Midnight Preview Network ready.']);

  const currentSymbol = TICKER_SYMBOLS[selectedTicker];
  const activeStock = stockData[currentSymbol] || { price: 0, change: '+0.00%' };
  const availableBalance = Number(usdcBalance ?? privateState?.cashBalance ?? 0);
  const addLog = (msg) => setLogs((prev) => [msg, ...prev.slice(0, 20)]);

  useEffect(() => {
    if (activeStock.price > 0 && orderType === 'limit') {
      setPrice(Number(activeStock.price).toFixed(2));
    }
  }, [selectedTicker, activeStock.price, orderType]);

  const effectivePrice = useMemo(() => {
    if (orderType === 'market') return Number(activeStock.price) || 0;
    return Number(price) || 0;
  }, [orderType, price, activeStock.price]);

  const orderValue = effectivePrice * (Number(quantity) || 0);

  // 🟢 Generate Positions with PnL injected
  const positionRows = useMemo(
    () =>
      Object.values(Ticker)
        .filter((t) => Number(privateState?.positions?.[t] || 0) > 0)
        .map((t) => {
          const size = Number(privateState.positions[t]);
          const sym = TICKER_SYMBOLS[t];
          const mark = Number(stockData[sym]?.price || 0);
          const avgEntry = portfolioStats.tickerStats[t]?.avgEntry || 0;
          const openPnL = (mark - avgEntry) * size;
          const pnlPct = avgEntry > 0 ? (openPnL / (avgEntry * size)) * 100 : 0;
          
          return { ticker: t, symbol: sym, size, mark, avgEntry, openPnL, pnlPct, value: size * mark };
        }),
    [privateState?.positions, stockData, portfolioStats]
  );

  const openOrders = privateState?.orders || [];
  const trades = portfolioStats.enrichedTrades || [];

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!isWalletConnected) { await connectWallet(); return; }
    if (isVerified === false) { toast.error('Verify wallet on Portfolio first'); return; }

    const qtyNum = Number(quantity);
    if (!qtyNum || qtyNum <= 0) { toast.error('Enter a valid order size'); return; }
    if (orderType === 'limit' && (!effectivePrice || effectivePrice <= 0)) { toast.error('Enter a valid limit price'); return; }
    if (orderType === 'market' && (!effectivePrice || effectivePrice <= 0)) { toast.error('Live price not loaded yet'); return; }
    if (isBuy && orderValue > availableBalance) { toast.error('Insufficient USDC. Claim from Faucet.'); return; }
    if (!isBuy) {
      const holding = Number(privateState.positions?.[selectedTicker] || 0);
      if (qtyNum > holding) { toast.error(`Insufficient ${currentSymbol} position`); return; }
    }

    const pContract = toContractPrice(effectivePrice);
    const qContract = BigInt(Math.floor(qtyNum));
    const side = isBuy ? OrderSide.BUY : OrderSide.SELL;

    setIsProving(true);
    setActiveBottomTab('logs');
    addLog(`PROVER: Building ZK proof (${orderType.toUpperCase()} ${isBuy ? 'BUY' : 'SELL'})...`);

    const txPromise = (async () => {
      if (contract?.callTx?.placeOrder) {
        addLog('NETWORK: Submitting confidential order to Midnight...');
        await contract.callTx.placeOrder(side, selectedTicker, qContract, pContract);
        addLog('SUCCESS: Order confirmed on ledger.');
      } else {
        await new Promise((r) => setTimeout(r, 1200));
      }

      const id = crypto.randomUUID().slice(0, 8);
      const ts = Date.now();

      if (orderType === 'market') {
        const trade = { id, ticker: selectedTicker, isBuy, price: effectivePrice, quantity: qtyNum, timestamp: ts, type: 'market' };
        setPrivateState((prev) => {
          const next = { ...prev, positions: { ...prev.positions }, trades: [trade, ...(prev.trades || [])] };
          if (isBuy) {
            next.cashBalance = Number(next.cashBalance) - orderValue;
            next.positions[selectedTicker] = BigInt(Number(next.positions[selectedTicker] || 0n) + qtyNum);
          } else {
            next.cashBalance = Number(next.cashBalance) + orderValue;
            next.positions[selectedTicker] = BigInt(Math.max(0, Number(next.positions[selectedTicker] || 0n) - qtyNum));
          }
          return next;
        });
        if (typeof setUsdcBalance === 'function') {
          setUsdcBalance((prev) => isBuy ? Math.max(0, Number(prev) - orderValue) : Number(prev) + orderValue);
        }
        setActiveBottomTab('trades');
        addLog(`TRADE: Filled ${qtyNum} ${currentSymbol} @ $${effectivePrice.toFixed(2)}`);
      } else {
        const order = { id, ticker: selectedTicker, isBuy, price: effectivePrice, quantity: qtyNum, timestamp: ts, type: 'limit', status: 'open' };
        setPrivateState((prev) => {
          const next = { ...prev, orders: [order, ...(prev.orders || [])] };
          if (isBuy) next.cashBalance = Number(next.cashBalance) - orderValue;
          else {
            next.positions = { ...next.positions };
            next.positions[selectedTicker] = BigInt(Math.max(0, Number(next.positions[selectedTicker] || 0n) - qtyNum));
          }
          return next;
        });
        if (isBuy && typeof setUsdcBalance === 'function') setUsdcBalance((prev) => Math.max(0, Number(prev) - orderValue));
        setActiveBottomTab('orders');
        addLog(`ORDER: Limit ${isBuy ? 'BUY' : 'SELL'} #${id} committed.`);
      }
      setQuantity('');
    })();

    toast.promise(txPromise, {
      loading: `${orderType === 'market' ? 'Filling' : 'Submitting'} ${isBuy ? 'buy' : 'sell'}...`,
      success: orderType === 'market' ? 'Trade filled (ZK)' : 'Limit order placed (ZK)',
      error: (err) => err?.message || 'Transaction failed',
    });

    try { await txPromise; } catch (err) { addLog(`REJECTED: ${err.message}`); } finally { setIsProving(false); }
  };

  const handleCancelOrder = async (order) => {
    if (!isWalletConnected) { toast.error('Connect wallet first'); return; }
    const cancelPromise = (async () => {
      addLog(`PROVER: Cancelling order #${order.id}...`);
      if (contract?.callTx?.cancelOrder) {
        try {
          await contract.callTx.cancelOrder(order.salt ?? 0n, order.isBuy ? OrderSide.BUY : OrderSide.SELL, order.ticker, BigInt(Math.floor(Number(order.quantity))), toContractPrice(order.price));
        } catch { await new Promise((r) => setTimeout(r, 800)); }
      } else { await new Promise((r) => setTimeout(r, 800)); }

      const locked = Number(order.price) * Number(order.quantity);
      setPrivateState((prev) => {
        const next = { ...prev, orders: (prev.orders || []).filter((o) => o.id !== order.id), positions: { ...prev.positions } };
        if (order.isBuy) next.cashBalance = Number(next.cashBalance) + locked;
        else next.positions[order.ticker] = BigInt(Number(next.positions[order.ticker] || 0n) + Number(order.quantity));
        return next;
      });
      if (order.isBuy && typeof setUsdcBalance === 'function') setUsdcBalance((prev) => Number(prev) + locked);
      addLog(`CANCELLED: Order #${order.id}`);
    })();
    toast.promise(cancelPromise, { loading: 'Cancelling order...', success: 'Order cancelled', error: 'Cancel failed' });
  };

  const handleClosePosition = (ticker, size) => {
    setSelectedTicker(ticker);
    setIsBuy(false);
    setOrderType('market');
    setQuantity(String(size));
    setPrice(Number(stockData[TICKER_SYMBOLS[ticker]]?.price || 0).toFixed(2));
    toast('Position loaded into sell ticket', { icon: '📉' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white selection:bg-[#A855F7] selection:text-white p-4 md:p-6 flex flex-col gap-6 font-sans">
      
      <div className="shrink-0 flex flex-wrap md:flex-nowrap items-center justify-between p-4 bg-[#1A1A22] border-2 border-white shadow-[4px_4px_0px_0px_#FFFFFF] gap-4">
        <div className="flex items-center gap-4">
          <StockIcon symbol={currentSymbol} size="w-12 h-12" />
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-none">{currentSymbol} / USDC</h1>
            <div className="text-xs font-bold text-zinc-400 uppercase mt-1">{TICKER_NAMES[selectedTicker]}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6 font-mono">
          <div><div className="text-xs font-bold text-zinc-400 uppercase">Live Price</div><div className="text-lg font-black text-[#10B981]">${Number(activeStock.price).toFixed(2)}</div></div>
          <div><div className="text-xs font-bold text-zinc-400 uppercase">24h Change</div><div className={`text-lg font-black ${String(activeStock.change).includes('-') ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>{activeStock.change}</div></div>
          <div className="hidden lg:block"><div className="text-xs font-bold text-zinc-400 uppercase">Available USDC</div><div className="text-lg font-black text-[#A855F7]">${availableBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div></div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:h-[560px] lg:min-h-[560px]">
        {/* Markets List */}
        <div className="w-full lg:w-72 flex flex-col bg-[#1A1A22] border-2 border-white shadow-[4px_4px_0px_0px_#A855F7] h-[400px] lg:h-full">
          <div className="p-3 border-b-2 border-white bg-[#0A0A0C]">
            <input type="text" placeholder="SEARCH MARKET..." className="w-full bg-[#0A0A0C] border-2 border-white p-3 font-bold text-xs uppercase text-white focus:outline-none focus:bg-[#A855F7] transition-colors" />
          </div>
          <div className="flex-1 overflow-y-auto bg-[#0A0A0C]">
            {Object.values(Ticker).map((t) => {
              const sym = TICKER_SYMBOLS[t];
              const data = stockData[sym] || { price: 0, change: '+0.00%' };
              const down = String(data.change).includes('-');
              return (
                <button key={t} type="button" onClick={() => setSelectedTicker(t)} className={`w-full flex items-center justify-between gap-3 p-3 border-b border-white/10 text-left transition-all ${selectedTicker === t ? 'bg-[#1A1A22] border-l-4 border-l-[#A855F7]' : 'hover:bg-[#1A1A22]/60 border-l-4 border-l-transparent'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <StockIcon symbol={sym} size="w-8 h-8" />
                    <div className="min-w-0"><div className="font-black text-sm uppercase">{sym}</div><div className="text-[10px] font-bold text-zinc-500 uppercase truncate">{TICKER_NAMES[t]?.split(' ')[0]}</div></div>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <div className="text-sm font-bold">${Number(data.price).toFixed(2)}</div>
                    <div className={`text-[10px] font-bold ${down ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>{data.change}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-[#1A1A22] border-2 border-white shadow-[4px_4px_0px_0px_#FFFFFF] h-[400px] lg:h-full min-h-[400px] overflow-hidden">
          <div className="flex items-center px-4 py-2 border-b-2 border-white bg-[#0A0A0C] text-xs font-black uppercase shrink-0">
            <span className="text-black px-3 py-1 bg-white border border-white">Candles</span>
            <span className="text-zinc-400 ml-auto font-mono text-[10px]">LIVE · {currentSymbol}</span>
          </div>
          <div className="relative flex-1 w-full min-h-[320px] min-h-0"><StockChart tickerSymbol={currentSymbol} /></div>
        </div>

        {/* Order Ticket */}
        <div className="w-full lg:w-[340px] flex flex-col bg-[#1A1A22] border-2 border-white shadow-[4px_4px_0px_0px_#FFFFFF] h-auto lg:h-full lg:overflow-hidden">
          <div className="p-4 border-b-2 border-white bg-[#0A0A0C] flex items-center justify-between shrink-0">
            <h3 className="text-lg font-black uppercase">Order Ticket</h3>
            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase">Bal ${availableBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <form onSubmit={handlePlaceOrder} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setIsBuy(true)} className={`py-3 font-black text-xs uppercase border-2 transition-all ${isBuy ? 'border-white bg-[#10B981] text-[#0A0A0C] shadow-[3px_3px_0px_0px_#FFFFFF]' : 'border-zinc-700 bg-[#0A0A0C] text-zinc-500 hover:border-white hover:text-white'}`}>Buy</button>
              <button type="button" onClick={() => setIsBuy(false)} className={`py-3 font-black text-xs uppercase border-2 transition-all ${!isBuy ? 'border-white bg-[#EF4444] text-white shadow-[3px_3px_0px_0px_#FFFFFF]' : 'border-zinc-700 bg-[#0A0A0C] text-zinc-500 hover:border-white hover:text-white'}`}>Sell</button>
            </div>
            <div className="flex p-1 bg-[#0A0A0C] border-2 border-white gap-1">
              {['limit', 'market'].map((t) => (
                <button key={t} type="button" onClick={() => setOrderType(t)} className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-wider transition-colors border ${orderType === t ? 'bg-white text-black border-white' : 'bg-transparent text-zinc-400 border-transparent hover:text-white'}`}>{t}</button>
              ))}
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase text-zinc-400 mb-2"><span>{orderType === 'market' ? 'Est. Fill Price' : 'Limit Price'}</span><span>USDC</span></div>
              <div className={`bg-[#0A0A0C] border-2 border-white flex items-center px-3 py-3 ${orderType === 'market' ? 'opacity-60' : 'focus-within:bg-[#A855F7]'}`}>
                <span className="text-white font-black mr-2">$</span>
                <input disabled={isProving || orderType === 'market'} type="number" step="0.01" value={orderType === 'market' ? Number(activeStock.price).toFixed(2) : price} onChange={(e) => setPrice(e.target.value)} className="bg-transparent border-none text-white w-full font-mono text-sm font-bold focus:outline-none" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase text-zinc-400 mb-2"><span>Size</span><span>{currentSymbol}</span></div>
              <div className="bg-[#0A0A0C] border-2 border-white flex items-center px-3 py-3 focus-within:bg-[#A855F7]">
                <input disabled={isProving} type="number" min="0" step="1" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="bg-transparent border-none text-white w-full font-mono text-sm font-bold focus:outline-none placeholder-zinc-600" />
              </div>
              <div className="mt-2 flex gap-2">
                {[25, 50, 75, 100].map((pct) => (
                  <button key={pct} type="button" disabled={isProving} onClick={() => {
                    if (isBuy) { const px = effectivePrice || 1; const maxQty = Math.floor((availableBalance * (pct / 100)) / px); setQuantity(String(Math.max(0, maxQty))); }
                    else { const holding = Number(privateState?.positions?.[selectedTicker] || 0); setQuantity(String(Math.floor(holding * (pct / 100)))); }
                  }} className="flex-1 py-1.5 text-[10px] font-black uppercase border border-zinc-600 bg-[#0A0A0C] hover:border-white hover:text-white text-zinc-400">{pct}%</button>
                ))}
              </div>
            </div>
            <div className="mt-auto space-y-2 pt-4 border-t-2 border-white/15 text-xs font-mono font-bold uppercase">
              <div className="flex justify-between"><span className="text-zinc-500">Order Value</span><span className="text-[#A855F7]">${orderValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Available USDC</span><span className="text-white">${availableBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">{currentSymbol} Position</span><span className="text-white">{Number(privateState?.positions?.[selectedTicker] || 0).toString()}</span></div>
            </div>
            {!isWalletConnected ? (
              <button type="button" onClick={connectWallet} className="w-full py-4 font-black uppercase tracking-wider text-sm border-2 border-white bg-white text-[#0A0A0C] shadow-[4px_4px_0px_0px_#A855F7] hover:bg-zinc-200 transition-all">Connect Wallet to Trade</button>
            ) : (
              <button type="submit" disabled={isProving} className={`w-full py-4 font-black uppercase tracking-wider text-sm border-2 border-white transition-all ${isProving ? 'bg-[#0A0A0C] text-zinc-600 cursor-not-allowed border-zinc-700' : isBuy ? 'bg-[#10B981] text-[#0A0A0C] shadow-[4px_4px_0px_0px_#FFFFFF] hover:brightness-110' : 'bg-[#EF4444] text-white shadow-[4px_4px_0px_0px_#FFFFFF] hover:brightness-110'}`}>{isProving ? 'Compiling ZK Proof...' : `${orderType === 'market' ? 'Market' : 'Limit'} ${isBuy ? 'Buy' : 'Sell'} ${currentSymbol}`}</button>
            )}
          </form>
        </div>
      </div>

      {/* BOTTOM TABS */}
      <div className="w-full min-h-[300px] flex flex-col bg-[#1A1A22] border-2 border-white shadow-[4px_4px_0px_0px_#10B981]">
        <div className="flex items-stretch border-b-2 border-white bg-[#0A0A0C] overflow-x-auto">
          {BOTTOM_TABS.map((tab) => {
            const count = tab.id === 'orders' ? openOrders.length : tab.id === 'positions' ? positionRows.length : tab.id === 'trades' ? trades.length : null;
            const active = activeBottomTab === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveBottomTab(tab.id)} className={`relative flex items-center justify-center gap-2 min-w-[110px] px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.12em] border-r-2 border-white/20 transition-colors ${active ? 'bg-white text-black' : 'bg-transparent text-zinc-400 hover:text-white hover:bg-[#1A1A22]'}`}>
                <span className="leading-none">{tab.label}</span>
                {count !== null && <span className={`leading-none px-1.5 py-0.5 text-[9px] border ${active ? 'border-black bg-black text-white' : 'border-zinc-600 text-zinc-400'}`}>{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto bg-[#0A0A0C] p-4 md:p-5">
          {activeBottomTab === 'positions' && (positionRows.length ? (
            <table className="w-full text-left text-xs font-mono min-w-[640px]">
              <thead><tr className="text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b-2 border-zinc-800"><th className="pb-3 pr-4">Asset</th><th className="pb-3 pr-4">Size</th><th className="pb-3 pr-4">Avg Entry</th><th className="pb-3 pr-4">Mark</th><th className="pb-3 pr-4">Unrealized PnL</th><th className="pb-3 text-right">Action</th></tr></thead>
              <tbody>{positionRows.map((row) => (
                <tr key={row.symbol} className="border-b border-zinc-900 hover:bg-[#121218]">
                  <td className="py-3.5 pr-4"><div className="flex items-center gap-2 font-black uppercase text-white"><StockIcon symbol={row.symbol} size="w-6 h-6" />{row.symbol}</div></td>
                  <td className="py-3.5 pr-4 text-white font-bold">{row.size}</td>
                  <td className="py-3.5 pr-4 text-zinc-400">${row.avgEntry.toFixed(2)}</td>
                  <td className="py-3.5 pr-4 text-zinc-300">${row.mark.toFixed(2)}</td>
                  <td className="py-3.5 pr-4 font-bold"><PnLDisplay value={row.openPnL} /> <span className="text-[9px] ml-1 opacity-70">(<PnLDisplay value={row.pnlPct} isPercent={true} />)</span></td>
                  <td className="py-3.5 text-right"><button type="button" onClick={() => handleClosePosition(row.ticker, row.size)} className="px-3 py-1.5 bg-[#EF4444] text-white font-black uppercase text-[9px] border border-white hover:bg-white hover:text-black">Close</button></td>
                </tr>
              ))}</tbody>
            </table>
          ) : <EmptyState title="No open positions" subtitle="Buy stock to open a shielded position" />)}

          {activeBottomTab === 'orders' && (openOrders.length ? (
            <table className="w-full text-left text-xs font-mono min-w-[720px]">
              <thead><tr className="text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b-2 border-zinc-800"><th className="pb-3 pr-4">Market</th><th className="pb-3 pr-4">Side</th><th className="pb-3 pr-4">Type</th><th className="pb-3 pr-4">Price</th><th className="pb-3 pr-4">Size</th><th className="pb-3 text-right">Action</th></tr></thead>
              <tbody>{openOrders.map((o) => (
                <tr key={o.id} className="border-b border-zinc-900 hover:bg-[#121218]">
                  <td className="py-3.5 pr-4"><div className="flex items-center gap-2 font-black uppercase text-white"><StockIcon symbol={TICKER_SYMBOLS[o.ticker]} size="w-6 h-6" />{TICKER_SYMBOLS[o.ticker]}</div></td>
                  <td className={`py-3.5 pr-4 font-black ${o.isBuy ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{o.isBuy ? 'BUY' : 'SELL'}</td>
                  <td className="py-3.5 pr-4 text-zinc-400 uppercase">{o.type || 'limit'}</td>
                  <td className="py-3.5 pr-4 text-zinc-300">${Number(o.price).toFixed(2)}</td>
                  <td className="py-3.5 pr-4 text-zinc-300">{o.quantity}</td>
                  <td className="py-3.5 text-right"><button type="button" onClick={() => handleCancelOrder(o)} className="px-3 py-1.5 bg-zinc-800 text-white font-black uppercase text-[9px] border border-zinc-500 hover:bg-white hover:text-black">Cancel</button></td>
                </tr>
              ))}</tbody>
            </table>
          ) : <EmptyState title="No open orders" subtitle="Limit orders appear here until filled or cancelled" />)}

          {activeBottomTab === 'trades' && (trades.length ? (
            <table className="w-full text-left text-xs font-mono min-w-[720px]">
              <thead><tr className="text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b-2 border-zinc-800"><th className="pb-3 pr-4">Time</th><th className="pb-3 pr-4">Market</th><th className="pb-3 pr-4">Side</th><th className="pb-3 pr-4">Price</th><th className="pb-3 pr-4">Size</th><th className="pb-3 text-right">Realized PnL</th></tr></thead>
              <tbody>{trades.map((t) => (
                <tr key={t.id} className="border-b border-zinc-900 hover:bg-[#121218]">
                  <td className="py-3.5 pr-4 text-zinc-500">{new Date(t.timestamp).toLocaleTimeString()}</td>
                  <td className="py-3.5 pr-4"><div className="flex items-center gap-2 font-black uppercase text-white"><StockIcon symbol={TICKER_SYMBOLS[t.ticker]} size="w-6 h-6" />{TICKER_SYMBOLS[t.ticker]}</div></td>
                  <td className={`py-3.5 pr-4 font-black ${t.isBuy ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{t.isBuy ? 'BUY' : 'SELL'}</td>
                  <td className="py-3.5 pr-4 text-zinc-300">${Number(t.price).toFixed(2)}</td>
                  <td className="py-3.5 pr-4 text-zinc-300">{t.quantity}</td>
                  <td className="py-3.5 text-right font-bold">{t.isBuy ? <span className="text-zinc-600">--</span> : <PnLDisplay value={t.pnl} />}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <EmptyState title="No recent trades" subtitle="Market fills and matched trades show here" />)}

          {activeBottomTab === 'logs' && (
            <div className="font-mono text-[11px] text-[#10B981] space-y-2 uppercase font-bold">
              {logs.map((log, i) => <div key={`${log}-${i}`} className="flex gap-2"><span className="text-zinc-600 shrink-0">{'>'}</span><span>{log}</span></div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}