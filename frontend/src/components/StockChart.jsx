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
    if (!containerRef.current) return;

    // Reset container
    containerRef.current.innerHTML = '';

    const tvSymbol = SYMBOL_MAP[tickerSymbol] || `NASDAQ:${tickerSymbol}`;

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    containerRef.current.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: '1',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      allow_symbol_change: false,
      calendar: false,
      backgroundColor: '#0A0A0C',
      gridColor: '#1A1A22',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      support_host: 'https://www.tradingview.com',
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [tickerSymbol]);

  return (
    <div className="w-full h-full relative bg-[#0A0A0C]">
      <div 
        className="tradingview-widget-container w-full h-full" 
        ref={containerRef} 
      />
    </div>
  );
}

export default memo(StockChart);