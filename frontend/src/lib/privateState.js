// frontend/src/lib/privateState.js

export const Ticker = {
  AAPL: 0,
  TSLA: 1,
  GOOGL: 2,
  MSFT: 3,
  AMZN: 4,
  NVDA: 5,
  SPY: 6,
  META: 7,
  NFLX: 8,
  AMD: 9,
};

export const OrderSide = {
  BUY: 0,
  SELL: 1,
};

export const TICKER_SYMBOLS = {
  [Ticker.AAPL]: 'AAPL',
  [Ticker.TSLA]: 'TSLA',
  [Ticker.GOOGL]: 'GOOGL',
  [Ticker.MSFT]: 'MSFT',
  [Ticker.AMZN]: 'AMZN',
  [Ticker.NVDA]: 'NVDA',
  [Ticker.SPY]: 'SPY',
  [Ticker.META]: 'META',
  [Ticker.NFLX]: 'NFLX',
  [Ticker.AMD]: 'AMD',
};

export const TICKER_NAMES = {
  [Ticker.AAPL]: 'Apple Inc.',
  [Ticker.TSLA]: 'Tesla Inc.',
  [Ticker.GOOGL]: 'Alphabet Inc.',
  [Ticker.MSFT]: 'Microsoft Corp.',
  [Ticker.AMZN]: 'Amazon.com',
  [Ticker.NVDA]: 'NVIDIA Corp.',
  [Ticker.SPY]: 'SPDR S&P 500 ETF',
  [Ticker.META]: 'Meta Platforms',
  [Ticker.NFLX]: 'Netflix Inc.',
  [Ticker.AMD]: 'Advanced Micro Devices',
};

export const LOGO_DOMAINS = {
  AAPL: 'apple.com',
  TSLA: 'tesla.com',
  GOOGL: 'google.com',
  MSFT: 'microsoft.com',
  AMZN: 'amazon.com',
  NVDA: 'nvidia.com',
  SPY: 'ssga.com',
  META: 'meta.com',
  NFLX: 'netflix.com',
  AMD: 'amd.com',
};

export const FAUCET_AMOUNT_USD = 1000;
export const FAUCET_AMOUNT_CENTS = 100_000n;
export const FAUCET_COOLDOWN_SECS = 604_800;

export function emptyPositions() {
  return {
    [Ticker.AAPL]: 0n,
    [Ticker.TSLA]: 0n,
    [Ticker.GOOGL]: 0n,
    [Ticker.MSFT]: 0n,
    [Ticker.AMZN]: 0n,
    [Ticker.NVDA]: 0n,
    [Ticker.SPY]: 0n,
    [Ticker.META]: 0n,
    [Ticker.NFLX]: 0n,
    [Ticker.AMD]: 0n,
  };
}

export const initialPrivateState = {
  cashBalance: 0,
  positions: emptyPositions(),
  orders: [],
  trades: [],
  secretKeyHex: null,
  isVerified: false,
  lastFaucetClaimAt: 0,
};

export function createWitnesses(getState, setState) {
  const read = () => getState();
  const write = (next) => {
    setState(next);
    return next;
  };

  return {
    getPrivateBalance: (ctx) => {
      const s = read();
      const bal = BigInt(Math.floor(Number(s.cashBalance || 0) * 100));
      return [ctx.privateState ?? s, bal];
    },
    getPrivateStockPosition: (ctx, ticker) => {
      const s = read();
      const pos = BigInt(s.positions?.[ticker] ?? 0n);
      return [ctx.privateState ?? s, pos];
    },
    getOrderSalt: (ctx) => {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
      return [ctx.privateState ?? read(), BigInt(`0x${hex}`)];
    },
    getLocalSecretKey: (ctx) => {
      const s = read();
      let key;
      if (s.secretKeyHex) {
        key = Uint8Array.from(s.secretKeyHex.match(/.{1,2}/g).map((h) => parseInt(h, 16)));
      } else {
        key = new Uint8Array(32);
        crypto.getRandomValues(key);
        const hex = [...key].map((b) => b.toString(16).padStart(2, '0')).join('');
        write({ ...s, secretKeyHex: hex });
      }
      return [ctx.privateState ?? s, key];
    },
    creditPrivateCash: (ctx, amount) => {
      const s = read();
      const addUsd = Number(amount) / 100;
      const cash = Number(s.cashBalance || 0) + addUsd;
      const next = write({ ...s, cashBalance: cash });
      return [ctx.privateState ?? next, BigInt(Math.floor(cash * 100))];
    },
    debitPrivateCash: (ctx, amount) => {
      const s = read();
      const subUsd = Number(amount) / 100;
      const cash = Math.max(0, Number(s.cashBalance || 0) - subUsd);
      const next = write({ ...s, cashBalance: cash });
      return [ctx.privateState ?? next, BigInt(Math.floor(cash * 100))];
    },
    creditPrivateStock: (ctx, ticker, quantity) => {
      const s = read();
      const cur = BigInt(s.positions?.[ticker] ?? 0n);
      const pos = cur + BigInt(quantity);
      const positions = { ...s.positions, [ticker]: pos };
      const next = write({ ...s, positions });
      return [ctx.privateState ?? next, pos];
    },
    debitPrivateStock: (ctx, ticker, quantity) => {
      const s = read();
      const cur = BigInt(s.positions?.[ticker] ?? 0n);
      const q = BigInt(quantity);
      const pos = cur >= q ? cur - q : 0n;
      const positions = { ...s.positions, [ticker]: pos };
      const next = write({ ...s, positions });
      return [ctx.privateState ?? next, pos];
    },
    getCurrentTimestamp: (ctx) => {
      const now = BigInt(Math.floor(Date.now() / 1000));
      return [ctx.privateState ?? read(), now];
    },
    getVerificationVoucher: (ctx) => {
      return [ctx.privateState ?? read(), new Uint8Array(64)];
    },
  };
}