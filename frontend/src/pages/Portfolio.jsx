// frontend/src/pages/Portfolio.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { TICKER_SYMBOLS, TICKER_NAMES, LOGO_DOMAINS } from '../lib/privateState';
import { useLiveStockData } from '../hooks/useLiveStockData';

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

const PnLDisplay = ({ value, isPercent = false, lg = false }) => {
  if (value === undefined || value === null || isNaN(value)) return <span className="text-zinc-500">--</span>;
  const isPositive = value >= 0;
  const prefix = isPositive ? '+' : '-';
  const formatted = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <span className={`${isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'} ${lg ? 'text-xl md:text-2xl font-black font-mono' : 'font-bold'}`}>
      {prefix}{isPercent ? '' : '$'}{formatted}{isPercent ? '%' : ''}
    </span>
  );
};

export default function Portfolio() {
  const {
    isConnected,
    connectWallet,
    userAddress,
    usdcBalance,
    isVerified,
    verifyWalletOnChain,
    privateState,
    portfolioStats,
    contractAddress,
    network,
  } = useWallet();

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] text-white p-6 flex flex-col items-center justify-center gap-6">
        <h1 className="text-3xl font-black uppercase">Portfolio</h1>
        <p className="text-xs font-bold uppercase text-zinc-500 text-center max-w-md">
          Connect your Midnight Lace wallet to load shielded USDC, positions, and PnL
          for this account.
        </p>
        <button
          type="button"
          onClick={connectWallet}
          className="px-8 py-4 bg-[#A855F7] border-2 border-white font-black uppercase text-sm shadow-[4px_4px_0px_0px_#FFFFFF]"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  const { stockData } = useLiveStockData();
  const [activeTab, setActiveTab] = useState('positions');

  // Calculate Positions & Total Open PnL
  let totalOpenPnL = 0;
  const positions = Object.entries(privateState?.positions || {})
    .filter(([, v]) => Number(v) > 0)
    .map(([k, v]) => {
      const sym = TICKER_SYMBOLS[k];
      const markPrice = Number(stockData[sym]?.price || 0);
      const size = Number(v);
      const avgEntry = portfolioStats.tickerStats[k]?.avgEntry || 0;
      const openPnL = (markPrice - avgEntry) * size;
      const pnlPct = avgEntry > 0 ? (openPnL / (avgEntry * size)) * 100 : 0;
      const val = size * markPrice;
      
      totalOpenPnL += openPnL;
      
      return { ticker: Number(k), symbol: sym, name: TICKER_NAMES[k], size, avgEntry, markPrice, openPnL, pnlPct, value: val };
    });

  const trades = portfolioStats.enrichedTrades || [];
  
  // Total Value = Cash + Value of Open Positions
  const totalValue = usdcBalance + positions.reduce((sum, p) => sum + p.value, 0);
  const realizedPnL = portfolioStats.totalRealized || 0;

  const short = userAddress ? `${userAddress.slice(0, 8)}…${userAddress.slice(-6)}` : 'Not connected';

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white p-4 md:p-6 flex flex-col gap-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase">Portfolio</h1>
          <div className="text-sm font-mono font-bold text-zinc-400 mt-2">{short}</div>
          <div className="text-[10px] font-mono text-zinc-600 mt-1">{network} · {contractAddress?.slice(0, 12)}…</div>
        </div>
        <div className="flex gap-2">
          {!isConnected && (
            <button onClick={connectWallet} className="px-6 py-3 bg-white text-black font-black uppercase text-xs border-2 border-white shadow-[3px_3px_0px_0px_#A855F7]">Connect</button>
          )}
          <Link to="/trade" className="px-6 py-3 bg-[#A855F7] text-white font-black uppercase text-xs border-2 border-white shadow-[3px_3px_0px_0px_#FFFFFF]">Trade</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
        {[
          { label: 'Total Value', value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'text-white' },
          { label: 'Open P&L', pnl: totalOpenPnL },
          { label: 'Realized P&L', pnl: realizedPnL },
          { label: 'USDC (shielded)', value: `$${Number(usdcBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'text-[#A855F7]' },
          { label: 'Status', value: isVerified ? 'VERIFIED' : 'UNVERIFIED', color: isVerified ? 'text-[#10B981]' : 'text-[#EF4444]' },
        ].map((s, idx) => (
          <div key={idx} className="bg-[#1A1A22] border-2 border-white p-4 shadow-[4px_4px_0px_0px_#FFFFFF] flex flex-col justify-center">
            <div className="text-[10px] md:text-xs font-black text-zinc-400 uppercase mb-2">{s.label}</div>
            {s.value !== undefined ? (
              <div className={`text-xl md:text-2xl font-mono font-black ${s.color}`}>{s.value}</div>
            ) : (
              <PnLDisplay value={s.pnl} lg={true} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-[#1A1A22] border-2 border-white shadow-[4px_4px_0px_0px_#A855F7] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-lg font-black uppercase">Wallet Verification</h2>
              <span className={`px-2 py-1 text-[10px] font-black uppercase border-2 ${isVerified ? 'bg-[#10B981] text-black border-white' : 'bg-[#EF4444] text-white border-white'}`}>
                {isVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>
            <p className="text-xs font-bold uppercase text-zinc-400 max-w-2xl leading-relaxed">
              Calls on-chain <span className="text-white">verifyWallet</span>. Required before <span className="text-white">claimFaucet</span> and <span className="text-white">placeOrder</span>.
            </p>
          </div>
          <button
            type="button"
            disabled={isVerified || !isConnected}
            onClick={verifyWalletOnChain}
            className={`px-8 py-4 font-black uppercase text-sm border-2 border-white shrink-0 ${isVerified ? 'bg-[#10B981] text-black cursor-default' : !isConnected ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-[#A855F7] text-white shadow-[4px_4px_0px_0px_#FFFFFF] hover:bg-[#10B981] hover:text-black'}`}
          >
            {isVerified ? 'Verified' : isConnected ? 'Verify Now' : 'Connect First'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[320px] bg-[#1A1A22] border-2 border-white shadow-[4px_4px_0px_0px_#10B981] flex flex-col">
        <div className="flex border-b-2 border-white bg-[#0A0A0C]">
          {['positions', 'orders', 'trades'].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-6 py-4 font-black uppercase text-xs border-r-2 border-white/20 ${activeTab === t ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex-1 bg-[#0A0A0C] p-6 overflow-auto">
          {activeTab === 'positions' && (positions.length ? (
            <table className="w-full text-xs font-mono text-left">
              <thead><tr className="text-zinc-500 uppercase text-[10px] border-b border-zinc-800"><th className="pb-3 pr-4">Asset</th><th className="pb-3 pr-4">Size</th><th className="pb-3 pr-4">Avg Entry</th><th className="pb-3 pr-4">Mark Price</th><th className="pb-3 pr-4">Unrealized PnL</th><th className="pb-3 text-right">Value</th></tr></thead>
              <tbody>{positions.map((p) => (
                <tr key={p.symbol} className="border-b border-zinc-900">
                  <td className="py-4 font-black flex items-center gap-3"><StockIcon symbol={p.symbol} /><div><div className="text-white">{p.symbol}</div><div className="text-[10px] font-sans text-zinc-500">{p.name}</div></div></td>
                  <td className="py-4 text-[#10B981] font-bold">{p.size}</td>
                  <td className="py-4 text-zinc-400">${p.avgEntry.toFixed(2)}</td>
                  <td className="py-4 text-zinc-300">${p.markPrice.toFixed(2)}</td>
                  <td className="py-4 font-bold"><PnLDisplay value={p.openPnL} /> <span className="text-[9px] ml-1 opacity-70">(<PnLDisplay value={p.pnlPct} isPercent={true} />)</span></td>
                  <td className="py-4 text-right text-white font-bold">${p.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <div className="text-center text-zinc-500 font-black uppercase text-sm py-16">No open positions</div>)}
          
          {activeTab === 'orders' && (
            <div className="text-center text-zinc-500 font-black uppercase text-sm py-16">
              {(privateState.orders || []).length ? `${privateState.orders.length} open order(s) — manage on Trade page` : 'No open orders'}
            </div>
          )}

          {activeTab === 'trades' && (trades.length ? (
            <table className="w-full text-xs font-mono text-left">
              <thead><tr className="text-zinc-500 uppercase text-[10px] border-b border-zinc-800"><th className="pb-3 pr-4">Time</th><th className="pb-3 pr-4">Asset</th><th className="pb-3 pr-4">Side</th><th className="pb-3 pr-4">Price</th><th className="pb-3 pr-4">Size</th><th className="pb-3 text-right">Realized PnL</th></tr></thead>
              <tbody>{trades.map((t) => (
                <tr key={t.id} className="border-b border-zinc-900">
                  <td className="py-4 text-zinc-500">{new Date(t.timestamp).toLocaleTimeString()}</td>
                  <td className="py-4 font-black uppercase flex items-center gap-2"><StockIcon symbol={TICKER_SYMBOLS[t.ticker]} />{TICKER_SYMBOLS[t.ticker]}</td>
                  <td className={`py-4 font-black ${t.isBuy ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{t.isBuy ? 'BUY' : 'SELL'}</td>
                  <td className="py-4 text-zinc-300">${Number(t.price).toFixed(2)}</td>
                  <td className="py-4 text-zinc-300">{t.quantity}</td>
                  <td className="py-4 text-right font-bold">{t.isBuy ? <span className="text-zinc-600">--</span> : <PnLDisplay value={t.pnl} />}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <div className="text-center text-zinc-500 font-black uppercase text-sm py-16">No trades yet</div>)}
        </div>
      </div>
    </div>
  );
}