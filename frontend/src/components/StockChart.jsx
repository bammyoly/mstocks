// frontend/src/components/StockChart.jsx
import React, { useEffect, useRef, memo } from 'react';

const SYMBOL_MAP = {
  AAPL: 'NASDAQ:AAPL',
  TSLA: 'NASDAQ:TSLA',
  GOOGL: 'NASDAQ:GOOGL',
  MSFT: 'NASDAQ:MSFT',
  AMZN: 'NASDAQ:AMZN',
  NVDA: 'NASDAQ:NVDA',
  SPY: 'AMEX:SPY',
  META: 'NASDAQ:META',
  NFLX: 'NASDAQ:NFLX',
  AMD: 'NASDAQ:AMD',
};

function StockChart({ tickerSymbol }) {
  const containerRef = useRef(null);

  useEffect(() => {
    // Generate a unique ID for this chart instance
    const chartId = `tv_${Math.random().toString(36).substring(2, 9)}`;
    if (containerRef.current) {
      containerRef.current.id = chartId;
    }

    let tvWidget = null;
    const tvSymbol = SYMBOL_MAP[tickerSymbol] || `NASDAQ:${tickerSymbol}`;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (typeof window.TradingView !== 'undefined' && containerRef.current) {
        tvWidget = new window.TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: '1', // 1-minute candles for live movement
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          enable_publishing: false,
          backgroundColor: '#0A0A0C', // Matches neo-brutalist dark bg
          gridColor: '#1A1A22',
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: chartId,
        });
      }
    };

    document.head.appendChild(script);

    return () => {
      if (tvWidget && typeof tvWidget.remove === 'function') {
        try { tvWidget.remove(); } catch (e) {}
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [tickerSymbol]);

  return (
    <div className="absolute inset-0 w-full h-full min-h-[320px] bg-[#0A0A0C] p-1">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

export default memo(StockChart);