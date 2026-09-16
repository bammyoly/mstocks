// frontend/src/hooks/useLiveStockData.js
import { useState, useEffect, useRef } from 'react';

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

const SYMBOLS = [
  'AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN',
  'NVDA', 'SPY', 'META', 'NFLX', 'AMD',
];

function emptyQuote(fallback = 0) {
  return {
    price: fallback,
    rawPrice: fallback,
    change: '+0.00%',
    high: '0.00',
    low: '0.00',
    vol: '--',
  };
}

const INITIAL = Object.fromEntries(SYMBOLS.map((s) => [s, emptyQuote()]));

export function useLiveStockData() {
  const [stockData, setStockData] = useState(INITIAL);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  // REST snapshot
  useEffect(() => {
    if (!FINNHUB_KEY) {
      console.warn('Missing VITE_FINNHUB_API_KEY');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      try {
        const results = await Promise.all(
          SYMBOLS.map(async (symbol) => {
            const res = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`
            );
            const data = await res.json();
            return {
              symbol,
              price: data.c || 0,
              changePct:
                data.dp != null
                  ? `${data.dp >= 0 ? '+' : ''}${Number(data.dp).toFixed(2)}%`
                  : '+0.00%',
              high: data.h != null ? Number(data.h).toFixed(2) : '0.00',
              low: data.l != null ? Number(data.l).toFixed(2) : '0.00',
            };
          })
        );

        if (cancelled) return;

        setStockData((prev) => {
          const next = { ...prev };
          results.forEach(({ symbol, price, changePct, high, low }) => {
            if (price > 0) {
              next[symbol] = {
                ...next[symbol],
                price,
                rawPrice: price,
                change: changePct,
                high,
                low,
              };
            }
          });
          return next;
        });
      } catch (err) {
        console.error('Finnhub REST error:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchAll();
    // refresh snapshots every 60s (WebSocket handles ticks)
    const poll = setInterval(fetchAll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  // WebSocket live trades
  useEffect(() => {
    if (!FINNHUB_KEY) return;

    const socket = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_KEY}`);
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setIsConnected(true);
      SYMBOLS.forEach((symbol) => {
        socket.send(JSON.stringify({ type: 'subscribe', symbol }));
      });
    });

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== 'trade' || !message.data) return;
        setStockData((prev) => {
          const next = { ...prev };
          message.data.forEach((trade) => {
            const { s: symbol, p: lastPrice } = trade;
            if (SYMBOLS.includes(symbol) && lastPrice > 0) {
              next[symbol] = {
                ...next[symbol],
                price: lastPrice,
                rawPrice: lastPrice,
              };
            }
          });
          return next;
        });
      } catch {
        /* ignore */
      }
    });

    socket.addEventListener('close', () => setIsConnected(false));
    socket.addEventListener('error', () => setIsConnected(false));

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        SYMBOLS.forEach((symbol) => {
          socket.send(JSON.stringify({ type: 'unsubscribe', symbol }));
        });
        socket.close();
      }
    };
  }, []);

  return { stockData, isLoading, isConnected };
}