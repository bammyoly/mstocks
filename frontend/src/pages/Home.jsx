// frontend/src/pages/Home.jsx
// ─────────────────────────────────────────────────────────────────────────────
// mstocks — landing page
//
// Neo-brutalist design system (keep in sync across pages):
//   surfaces   #0A0A0C (page) · #12121A (panels) · #1A1A22 (raised)
//   accents    #A855F7 (primary / purple) · #9333EA (purple hover) · #10B981 (emerald)
//              #F5F5F0 (bone — used for contrast panels)
//   lines      2px white borders · hard offset shadows (shadow-[Xpx_Ypx_0px_0px_#color])
//   type       font-black Title Case headings · font-mono for anything "on-chain"
//
// Deployment facts (address, network, versions, deploy block, faucet) are
// imported from the generated ../contracts/trading/config — never hand-edit
// them here. `npm run deploy` in contract/ refreshes them automatically.
//
// Every animation respects prefers-reduced-motion (see GLOBAL_CSS).
// No new dependencies — pure React + Tailwind + a few lines of vanilla CSS.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TRADING_CONTRACT_ADDRESS,
  TRADING_DEPLOYMENT,
  TRADING_FAUCET_URL,
  TRADING_NETWORK,
} from '../contracts/trading/config';

/* ══════════════════════════════ Static data ══════════════════════════════ */

const NETWORK_LABEL = TRADING_NETWORK === 'preview' ? 'Midnight Preview' : `Midnight ${TRADING_NETWORK}`;
const DEPLOY_LABEL = `${TRADING_DEPLOYMENT.deployedAt.slice(0, 10)} · block ${(TRADING_DEPLOYMENT.blockHeight ?? 0).toLocaleString()}`;
const STACK_LABEL = `Compact ${TRADING_DEPLOYMENT.versions.language.replace(/\.0$/, '')} · midnight-js ${TRADING_DEPLOYMENT.versions.midnightJs}`;
const PROOF_LABEL = /localhost/.test(TRADING_DEPLOYMENT.endpoints.proofServer) ? 'local docker' : 'hosted (preview)';

const shortAddress = (addr) => `${addr.slice(0, 10)}…${addr.slice(-6)}`;
const shortHex = (h, head = 12, tail = 6) => `${h.slice(0, head)}…${h.slice(-tail)}`;

const TICKERS = ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'NVDA', 'SPY', 'META', 'NFLX', 'AMD'];

const MARKET_PRICES = {
  AAPL: '150.00', TSLA: '221.40', GOOGL: '174.10', MSFT: '418.55', AMZN: '185.20',
  NVDA: '131.10', SPY: '547.80', META: '505.30', NFLX: '689.90', AMD: '162.75',
};

const TAPE = [
  { sym: 'AAPL', price: '150.00', chg: '+1.24%', up: true },
  { sym: 'TSLA', price: '221.40', chg: '+0.82%', up: true },
  { sym: 'GOOGL', price: '174.10', chg: '−0.31%', up: false },
  { sym: 'MSFT', price: '418.55', chg: '+0.44%', up: true },
  { sym: 'AMZN', price: '185.20', chg: '+2.10%', up: true },
  { sym: 'NVDA', price: '131.10', chg: '+3.05%', up: true },
  { sym: 'SPY', price: '547.80', chg: '−0.18%', up: false },
  { sym: 'META', price: '505.30', chg: '+1.47%', up: true },
  { sym: 'NFLX', price: '689.90', chg: '+0.65%', up: true },
  { sym: 'AMD', price: '162.75', chg: '−0.92%', up: false },
];

const HERO_ORDER = {
  commitment: '0x9f3ce41ab77d0e5c2814fa90b6d2c7e51038af47a2b91c6d8e40f3a7c5d2916e',
  ownerKey: '0x84c1d2f0a9b3e675',
  ticker: 'NVDA',
};

const DEMO_WALLET = { cash: 1_000_000, shares: 10_000 };

const FEATURES = [
  {
    title: 'Wallet-Side Proving',
    desc: 'Your wallet proves, the network verifies. Price, size and balance never leave your device — the chain only checks the math.',
    icon: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  },
  {
    title: 'No Front-Running',
    desc: 'Prices and sizes are hidden until settlement. MEV bots and dark-pool predators find nothing to front-run.',
    icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  },
  {
    title: 'Provable Solvency',
    desc: 'Place orders the chain can verify you can afford — without ever revealing your balance to anyone.',
    icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  },
  {
    title: 'Compact Smart Contracts',
    desc: 'Seven ZK circuits, one address, a few hundred lines of Compact. No custodians, no middlemen — just you and the math.',
    icon: (
      <>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </>
    ),
  },
  {
    title: 'Private Balance Sheets',
    desc: 'Cash and positions across all ten listed tickers live in your wallet’s private state. They never touch a public database.',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </>
    ),
  },
  {
    title: 'Open & Verifiable',
    desc: 'Open-source circuits, public verifier keys, deterministic commitments. Trust the math, not a corporation.',
    icon: (
      <>
        <rect x="1" y="4" width="22" height="16" rx="0" ry="0" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </>
    ),
  },
];

const STEPS = [
  {
    title: 'Verify Your Wallet',
    desc: 'One proof registers a fresh, DApp-scoped key for your wallet. No address, no identity, no cross-app history — the ledger just marks you verified.',
    chip: 'verifyWallet()',
  },
  {
    title: 'Fund Privately',
    desc: 'Claim $1,000 of demo cash every 7 days from the on-chain faucet, deposit more, and mint test shares in any listed ticker. Balances live in your wallet’s private state.',
    chip: 'claimFaucet() · depositCash()',
  },
  {
    title: 'Commit an Order',
    desc: 'Solvency is checked inside a ZK proof, then the order is published as a single 32-byte hash. Changed your mind? cancelOrder() burns it — no trace, no penalty.',
    chip: 'placeOrder() · cancelOrder()',
  },
  {
    title: 'Match & Settle',
    desc: 'Two commitments are consumed together; only the aggregate price and volume become public. Each wallet applies the fill to its own private balances.',
    chip: 'executeTrade()',
  },
];

const COMPARISON = [
  { label: 'Cash balance', legacy: 'Known to the operator', mstocks: 'Shielded — lives in your wallet' },
  { label: 'Order price & size', legacy: 'Visible to the venue & HFTs', mstocks: 'Hashed into a commitment' },
  { label: 'Position size', legacy: 'Reconstructable from history', mstocks: 'Never published' },
  { label: 'Front-running risk', legacy: 'Structural (MEV)', mstocks: 'Nothing to front-run' },
  { label: 'Demo funds', legacy: 'Sign-up forms & KYC', mstocks: '$1k/week on-chain faucet' },
  { label: 'Custody', legacy: '“Not your keys, not your coins”', mstocks: 'Self-custodied, always' },
  { label: 'Auditability', legacy: 'Opaque order books', mstocks: 'Open circuits, on-chain proofs' },
];

const STATS = [
  { value: '10', label: 'Listed tickers' },
  { value: '7', label: 'ZK circuits on-chain' },
  { value: '$1k', label: 'Weekly demo faucet' },
  { value: '0', label: 'Third parties involved' },
];

const FAQS = [
  {
    q: 'What is Midnight?',
    a: 'A data-protection blockchain. Smart contracts written in the Compact language generate zero-knowledge proofs, so the network can verify an action without ever seeing the data behind it. mstocks runs on Midnight’s public Preview testnet.',
  },
  {
    q: 'What can other people actually see?',
    a: 'A short, fixed list: each order’s 32-byte commitment, your DApp-scoped owner key (unlinkable across apps), the active order count, the last trade price and total volume per ticker, a flag that your wallet is verified, and when you last claimed the faucet. Your cash balance, your positions, and every order’s price, size, and side never leave your wallet.',
  },
  {
    q: 'How can trades settle if the orders are hidden?',
    a: 'Counterparties share commitments directly. executeTrade verifies both commitments are live and belong to different traders, consumes them, and publishes only the aggregate statistics. Each wallet then applies the fill to its own private balances.',
  },
  {
    q: 'How do I get demo funds?',
    a: 'Verify your wallet once, then claim the on-chain faucet: $1,000 of demo cash every 7 days. You can also mint test shares of any listed ticker to practice selling. Network fees on Preview are covered by free tNIGHT from the Midnight faucet.',
  },
  {
    q: 'Is this live right now?',
    a: 'Yes — the contract is deployed on Midnight Preview. The address, transaction hash, deploy block, and exact toolchain versions ship with this app in src/contracts/trading/config.ts, generated by the deploy pipeline.',
  },
  {
    q: 'What happens if I lose my seed phrase?',
    a: 'Your private balances are derived from it, on your device. Without the seed, nobody — not even the contract — can recover them. That is what “confidential” means here: it’s a feature, not a bug.',
  },
];

/* ═══════════════════════════ Shared class tokens ═════════════════════════ */

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

const PANEL = 'bg-[#12121A] border-2 border-white';

const BTN_PRIMARY =
  `${FOCUS} group flex items-center justify-center gap-2 px-8 py-4 bg-[#A855F7] text-white font-black capitalize tracking-wider ` +
  'text-base transition-all border-2 border-white shadow-[4px_4px_0px_0px_#FFFFFF] ' +
  'hover:bg-[#9333EA] hover:shadow-[5px_5px_0px_0px_#10B981] ' +
  'active:translate-x-1 active:translate-y-1 active:shadow-none';

const BTN_SECONDARY =
  `${FOCUS} flex items-center justify-center px-8 py-4 bg-[#12121A] text-white font-black capitalize tracking-wider ` +
  'text-base transition-all border-2 border-white shadow-[4px_4px_0px_0px_#FFFFFF] ' +
  'hover:bg-[#10B981] hover:text-[#0A0A0C] active:translate-x-1 active:translate-y-1 active:shadow-none';

const INPUT =
  'w-full p-2.5 bg-[#0A0A0C] border-2 border-white text-white font-bold text-sm rounded-none ' +
  'focus:bg-[#A855F7] focus:text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

const GLOBAL_CSS = `
  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    .mstocks-marquee, .mstocks-float, .mstocks-shake, .mstocks-blink, .mstocks-scan, .mstocks-hang { animation: none !important; }
  }
  .neo-grid {
    background-image:
      linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size: 48px 48px;
  }
  .neo-dots {
    background-image: radial-gradient(rgba(255,255,255,0.08) 1.5px, transparent 1.5px);
    background-size: 24px 24px;
  }
  .neo-diagonal {
    background-image: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 6px,
      rgba(255,255,255,0.08) 6px,
      rgba(255,255,255,0.08) 7px
    );
  }
  @keyframes mstocks-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .mstocks-marquee { animation: mstocks-ticker 44s linear infinite; }
  .mstocks-marquee:hover { animation-play-state: paused; }
  @keyframes mstocks-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
  .mstocks-float { animation: mstocks-float 6s ease-in-out infinite; }
  @keyframes mstocks-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-3px); }
    40% { transform: translateX(3px); }
    60% { transform: translateX(-2px); }
    80% { transform: translateX(2px); }
  }
  .mstocks-shake { animation: mstocks-shake 0.4s ease-in-out 1; }
  @keyframes mstocks-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
  .mstocks-blink { animation: mstocks-blink 1s step-end infinite; }
  @keyframes mstocks-scan {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100%); }
  }
  .mstocks-scan { animation: mstocks-scan 3.5s linear infinite; }
  /* Gentle pendulum sway — makes the hero card read as "hanging" from the string above it */
  @keyframes mstocks-hang {
    0%, 100% { transform: rotate(-1.1deg); }
    50% { transform: rotate(1.1deg); }
  }
  .mstocks-hang {
    transform-origin: top center;
    animation: mstocks-hang 5.5s ease-in-out infinite;
    will-change: transform;
  }
  .mstocks-hang:hover {
    animation-play-state: paused;
  }
  details.mstocks-faq summary::-webkit-details-marker { display: none; }
  details.mstocks-faq summary { list-style: none; }
`;

/* ══════════════════════════════ ZK simulator ═════════════════════════════ */

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i += 1) arr[i] = Math.floor(Math.random() * 256);
  }
  return `0x${Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

const SIM_IDLE = { status: 'idle', lines: [], progress: 0, proof: null };

function useZkSimulation() {
  const [sim, setSim] = useState(SIM_IDLE);
  const timersRef = useRef([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setSim(SIM_IDLE);
  }, [clearTimers]);

  const run = useCallback(
    (order) => {
      clearTimers();
      const salt = randomHex(16);

      const log = [
        { text: `$ mstocks place-order --shield ${order.ticker}`, cls: 'text-white' },
        { text: 'collecting private witnesses…', cls: 'text-zinc-300' },
        order.side === 'BUY'
          ? {
              text: `  getPrivateBalance() → ${DEMO_WALLET.cash.toLocaleString()} ≥ ${order.notional.toLocaleString()} ✓`,
              cls: 'text-zinc-400',
            }
          : {
              text: `  getPrivateStockPosition(${order.ticker}) → ${DEMO_WALLET.shares.toLocaleString()} ≥ ${order.qty.toLocaleString()} ✓`,
              cls: 'text-zinc-400',
            },
        { text: '  getLocalSecretKey() ✓ dapp-key derived', cls: 'text-zinc-400' },
        { text: `  getOrderSalt() ✓ ${salt.slice(0, 18)}…`, cls: 'text-zinc-400' },
        { text: 'loading circuit placeOrder.zkir…', cls: 'text-zinc-300' },
        { text: 'generating zero-knowledge proof (wallet-side prover)…', cls: 'text-zinc-300' },
        {
          text: `commitment = persistentHash(salt ‖ ${order.side} ‖ ${order.ticker} ‖ ${order.qty} ‖ ${order.price})`,
          cls: 'text-[#A855F7]',
        },
        { text: `tx submitted → ${NETWORK_LABEL} ✓`, cls: 'text-[#10B981]' },
      ];

      const stepMs = 240;
      setSim({ status: 'running', lines: [], progress: 0, proof: null });

      log.forEach((line, i) => {
        timersRef.current.push(
          setTimeout(() => {
            setSim((s) => ({
              ...s,
              lines: [...s.lines, line],
              progress: Math.round(((i + 1) / log.length) * 100),
            }));
          }, i * stepMs),
        );
      });

      timersRef.current.push(
        setTimeout(() => {
          setSim((s) => ({
            ...s,
            status: 'done',
            proof: {
              circuit: 'placeOrder',
              commitment: randomHex(32),
              ownerKey: randomHex(8),
              delta: 'activeOrderCount: 0 → 1',
              shielded: `side ‖ ${order.ticker} ‖ ${order.price} ‖ ${order.qty} ‖ salt`,
            },
          }));
        }, log.length * stepMs + 160),
      );
    },
    [clearTimers],
  );

  return { sim, run, reset };
}

/* ════════════════════════════ Presentational ═════════════════════════════ */

function SectionHeading({ kicker, title, sub, id }) {
  return (
    <div className="mb-12 md:mb-16 text-center">
      <span className="inline-block mb-5 px-3 py-1 bg-[#12121A] border-2 border-white shadow-[3px_3px_0px_0px_#A855F7] text-xs font-black capitalize tracking-widest text-white">
        {kicker}
      </span>
      <h2 id={id} className="text-3xl md:text-5xl font-black capitalize tracking-tight text-white mb-4">
        {title}
      </h2>
      {sub && (
        <p className="text-zinc-300 max-w-2xl mx-auto font-medium leading-relaxed">{sub}</p>
      )}
    </div>
  );
}

function RedactedBar({ w, shake }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-3 ${w} bg-[#0A0A0C] border border-white/25 ${shake ? 'mstocks-shake' : ''}`}
    />
  );
}

/* ─────────────────────────────── HERO ──────────────────────────────────── */

function Hero() {
  const [revealTried, setRevealTried] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeUtc = now.toISOString().slice(11, 19);

  return (
    <section aria-label="Introduction" className="relative overflow-hidden border-b-2 border-white">
      {/* Ambient layers */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 neo-grid opacity-70" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(80% 60% at 15% 20%, rgba(168,85,247,0.18) 0%, transparent 60%), radial-gradient(60% 50% at 85% 90%, rgba(16,185,129,0.10) 0%, transparent 60%)',
          }}
        />
        {/* Ghost typography */}
        <span
          className="absolute -left-2 top-[68%] text-[18rem] md:text-[24rem] font-black leading-none select-none text-transparent hidden md:block"
          style={{ WebkitTextStroke: '2px rgba(255,255,255,0.05)' }}
        >
          ZK
        </span>
      </div>

      {/* ── Top status rail ── */}
      <div className="relative z-10 border-b-2 border-white bg-[#0A0A0C]">
        <div className="max-w-[1280px] mx-auto flex items-stretch text-[10px] md:text-xs font-mono font-bold tracking-wider">
          <span className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-[#0A0A0C] border-r-2 border-white uppercase">
            <span aria-hidden className="w-1.5 h-1.5 bg-[#0A0A0C] rounded-full mstocks-blink" />
            Live
          </span>
          <span className="flex items-center px-4 py-2 border-r-2 border-white text-zinc-400 uppercase">
            {NETWORK_LABEL}
          </span>
          <span className="hidden md:flex items-center px-4 py-2 border-r-2 border-white text-zinc-500">
            {shortAddress(TRADING_CONTRACT_ADDRESS)}
          </span>
          <span className="hidden lg:flex items-center px-4 py-2 border-r-2 border-white text-zinc-500">
            {STACK_LABEL}
          </span>
          <span className="ml-auto flex items-center px-4 py-2 border-l-2 border-white text-zinc-400">
            <span className="hidden sm:inline mr-2 text-zinc-600">UTC</span>
            {timeUtc}
          </span>
        </div>
      </div>

      {/* ── Hero body ── */}
      <div className="relative z-10 max-w-[1280px] mx-auto px-6 md:px-12 pt-14 md:pt-20 pb-20 md:pb-28">
        <div className="grid lg:grid-cols-12 gap-10 xl:gap-14 items-start">
          {/* ═══ COPY COLUMN ═══ */}
          <div className="lg:col-span-7 flex flex-col">
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <span className="inline-flex items-center gap-2 border-2 border-white bg-[#12121A] shadow-[3px_3px_0px_0px_#FFFFFF]">
                <span className="flex items-center gap-1.5 bg-[#A855F7] px-2.5 py-1.5 border-r-2 border-white">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" aria-hidden>
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  <span className="text-[10px] font-black tracking-widest text-white uppercase">Midnight</span>
                </span>
                <span className="px-2.5 py-1.5 text-[10px] font-mono font-bold tracking-widest text-zinc-300 uppercase">
                  v{TRADING_DEPLOYMENT.versions.language.replace(/\.0$/, '')}
                </span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-widest text-zinc-500 uppercase">
                <span aria-hidden className="w-2 h-px bg-zinc-600" />
                Confidential DEX
              </span>
            </div>

            {/* Headline — editorial, asymmetric */}
            <h1 className="font-black tracking-[-0.03em] leading-[0.92] mb-8">
              <span className="block text-5xl sm:text-7xl lg:text-8xl text-white">
                Trade like
              </span>
              <span className="block text-5xl sm:text-7xl lg:text-8xl text-white">
                no one is
              </span>
              <span className="inline-block relative mt-2">
                <span className="relative inline-block bg-[#A855F7] text-white px-4 py-1 border-2 border-white shadow-[6px_6px_0px_0px_#10B981] text-5xl sm:text-7xl lg:text-8xl">
                  watching.
                </span>
              </span>
            </h1>

            {/* Sub with structured accent */}
            <div className="relative max-w-xl mb-10 pl-5">
              <span aria-hidden className="absolute left-0 top-1 bottom-1 w-1 bg-white" />
              <p className="text-base md:text-lg text-zinc-300 leading-relaxed font-medium">
                Orders, balances, and positions never leave your wallet.
                The chain sees a <span className="font-mono font-bold text-white">32-byte commitment</span> —
                verified by zero-knowledge proofs, not trust.
              </p>
            </div>

            {/* CTAs + micro-metric */}
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center mb-10">
              <Link to="/trade" className={`${BTN_PRIMARY} w-full sm:w-auto`}>
                Start Trading
                <span aria-hidden className="transition-transform group-hover:translate-x-1 font-bold text-xl">→</span>
              </Link>
              <a href="#simulator" className={`${BTN_SECONDARY} w-full sm:w-auto`}>
                Watch the Proof
              </a>
              <a
                href="#how"
                className={`${FOCUS} hidden sm:inline-flex items-center gap-2 px-2 py-2 font-mono text-xs font-bold text-zinc-400 hover:text-white transition-colors uppercase tracking-wider`}
              >
                <span aria-hidden className="w-6 h-px bg-current" />
                How it works
              </a>
            </div>

            {/* Inline stat rail */}
            <dl className="grid grid-cols-3 border-2 border-white bg-[#0A0A0C] shadow-[4px_4px_0px_0px_#FFFFFF] max-w-xl">
              {[
                { k: 'Circuits', v: '7', unit: 'zk' },
                { k: 'Tickers', v: '10', unit: 'listed' },
                { k: 'Trust', v: '0', unit: 'parties' },
              ].map((s, i) => (
                <div
                  key={s.k}
                  className={`px-4 py-4 ${i < 2 ? 'border-r-2 border-white' : ''}`}
                >
                  <dt className="font-mono text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-1">
                    {s.k}
                  </dt>
                  <dd className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-white leading-none tracking-tight">{s.v}</span>
                    <span className="font-mono text-[10px] font-bold tracking-widest text-[#10B981] uppercase">
                      {s.unit}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* ═══ HERO CARD COLUMN ═══ */}
          <div className="lg:col-span-5 relative">
            {/* Column label */}
            <div className="hidden lg:flex items-center gap-3 mb-5 font-mono text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              <span aria-hidden className="w-8 h-px bg-zinc-600" />
              Fig. 01 — Order on-ledger
              <span aria-hidden className="flex-1 h-px bg-zinc-800" />
            </div>

            {/* Hanging string — anchors the card visually to the row above it */}
            <div aria-hidden className="hidden lg:flex justify-center">
              <span className="w-px h-6 bg-zinc-600" />
            </div>

            {/* Swaying wrapper — everything inside sways together like it's hanging from the string */}
            <div className="mstocks-hang relative">
              {/* Backdrop stack — layered brutalist depth */}
              <div className="relative">
                {/* Back plate */}
                <div
                  aria-hidden
                  className="absolute inset-0 translate-x-3 translate-y-3 border-2 border-white bg-[#A855F7]"
                />
                {/* Mid plate */}
                <div
                  aria-hidden
                  className="absolute inset-0 translate-x-1.5 translate-y-1.5 border-2 border-white bg-[#0A0A0C]"
                />

                {/* Main card */}
                <div className="relative bg-[#12121A] border-2 border-white">
                  {/* Card chrome header (window-style) */}
                  <div className="flex items-stretch border-b-2 border-white bg-[#0A0A0C]">
                    <div className="flex items-center gap-1.5 px-3 border-r-2 border-white">
                      <span aria-hidden className="w-2.5 h-2.5 border border-white bg-[#A855F7]" />
                      <span aria-hidden className="w-2.5 h-2.5 border border-white bg-zinc-700" />
                      <span aria-hidden className="w-2.5 h-2.5 border border-white bg-[#10B981]" />
                    </div>
                    <div className="flex-1 flex items-center justify-center px-3 py-2 border-r-2 border-white">
                      <span className="font-mono text-[10px] font-bold tracking-widest text-zinc-400 uppercase truncate">
                        order.commitment
                      </span>
                    </div>
                    <span className="flex items-center px-3 font-mono text-[10px] font-black tracking-widest text-[#0A0A0C] bg-white uppercase">
                      Demo
                    </span>
                  </div>

                  {/* Section: identity */}
                  <div className="px-5 py-4 border-b-2 border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
                        § Public state
                      </span>
                      <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-widest text-[#10B981] uppercase">
                        <span aria-hidden className="w-1.5 h-1.5 bg-[#10B981]" />
                        Verified
                      </span>
                    </div>

                    <dl className="space-y-2.5 font-mono text-xs">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-zinc-500 shrink-0">commitment</dt>
                        <dd title={HERO_ORDER.commitment} className="text-white font-bold break-all text-right">
                          {shortHex(HERO_ORDER.commitment)}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-zinc-500 shrink-0">owner_key</dt>
                        <dd className="text-white font-bold">
                          {shortHex(HERO_ORDER.ownerKey, 8, 4)}
                          <span className="text-zinc-600 font-normal"> ↳ dapp</span>
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-zinc-500 shrink-0">ticker</dt>
                        <dd className="inline-flex items-center gap-1.5">
                          <span aria-hidden className="w-1.5 h-1.5 bg-[#A855F7]" />
                          <span className="text-white font-bold">{HERO_ORDER.ticker}</span>
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Section: private (redacted) */}
                  <div className="relative px-5 py-4 border-b-2 border-white/10 neo-diagonal overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
                        § Private witnesses
                      </span>
                      <span className="font-mono text-[9px] font-bold tracking-widest text-[#A855F7] uppercase">
                        Wallet-only
                      </span>
                    </div>

                    <dl className="space-y-3 font-mono text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-zinc-500">price</dt>
                        <dd className="flex items-center gap-1">
                          <RedactedBar w="w-7" shake={revealTried} />
                          <RedactedBar w="w-10" shake={revealTried} />
                          <RedactedBar w="w-5" shake={revealTried} />
                          <RedactedBar w="w-8" shake={revealTried} />
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-zinc-500">qty</dt>
                        <dd className="flex items-center gap-1">
                          <RedactedBar w="w-6" shake={revealTried} />
                          <RedactedBar w="w-9" shake={revealTried} />
                          <RedactedBar w="w-4" shake={revealTried} />
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-zinc-500">side</dt>
                        <dd className="flex items-center gap-1">
                          <RedactedBar w="w-12" shake={revealTried} />
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Section: footer status */}
                  <div className="px-5 py-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 font-mono text-xs">
                      <span className="text-[#10B981] font-bold">✓ proof accepted</span>
                      <span className="text-zinc-500">Δ activeOrderCount +1</span>
                    </div>

                    {revealTried ? (
                      <p
                        role="status"
                        className="inline-block bg-[#A855F7] text-white border-2 border-white px-3 py-1.5 font-bold text-sm shadow-[3px_3px_0px_0px_#FFFFFF]"
                      >
                        ✗ Nice try — the preimage never leaves your wallet.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRevealTried(true)}
                        className={`${FOCUS} font-mono text-xs text-[#10B981] font-bold underline decoration-2 underline-offset-4 hover:text-white transition-colors`}
                      >
                        ▸ attempt to decrypt
                      </button>
                    )}
                  </div>
                </div>

                {/* Corner registration marks (crosshairs) */}
                <span aria-hidden className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white" />
                <span aria-hidden className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white" />
                <span aria-hidden className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white" />
                <span aria-hidden className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white" />

                {/* Stamp — deploy metadata */}
                <div className="hidden md:block absolute -right-3 -top-3 rotate-3 bg-[#10B981] text-[#0A0A0C] border-2 border-white px-3 py-1.5 font-mono text-[10px] font-black tracking-widest shadow-[3px_3px_0px_0px_#FFFFFF] uppercase">
                  zk-verified ✓
                </div>
              </div>
            </div>

            {/* Caption strip */}
            <div className="mt-6 border-2 border-white bg-[#0A0A0C] shadow-[3px_3px_0px_0px_#A855F7]">
              <div className="grid grid-cols-2 divide-x-2 divide-white">
                <div className="px-3 py-2.5">
                  <div className="font-mono text-[9px] font-bold tracking-widest text-zinc-500 uppercase mb-0.5">
                    Deploy
                  </div>
                  <div className="font-mono text-[11px] font-bold text-white truncate" title={TRADING_DEPLOYMENT.deployTxId}>
                    {DEPLOY_LABEL}
                  </div>
                </div>
                <div className="px-3 py-2.5">
                  <div className="font-mono text-[9px] font-bold tracking-widest text-zinc-500 uppercase mb-0.5">
                    Prover
                  </div>
                  <div className="font-mono text-[11px] font-bold text-[#10B981] uppercase">
                    {PROOF_LABEL}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function TickerTape() {
  const items = (hidden) => (
    <div aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {TAPE.map((t) => (
        <span key={t.sym} className="mx-7 flex items-center gap-2 font-mono text-sm font-bold text-white whitespace-nowrap">
          <span>{t.sym}</span>
          <span>${t.price}</span>
          <span className={t.up ? 'text-[#0A0A0C]' : 'text-white/70'}>
            {t.up ? '▲' : '▼'} {t.chg}
          </span>
          <span aria-hidden className="ml-7 text-white/40">//</span>
        </span>
      ))}
    </div>
  );
  return (
    <section aria-label="Market ticker (demo feed)" className="border-b-2 border-white bg-[#A855F7]">
      <div className="flex items-stretch">
        <span className="z-10 shrink-0 flex items-center bg-[#0A0A0C] border-r-2 border-white px-4 font-mono text-xs font-bold tracking-widest text-white uppercase">
          <span className="hidden sm:inline">mstocks&nbsp;·&nbsp;</span>demo&nbsp;feed
        </span>
        <div className="overflow-hidden py-3 flex-1">
          <div className="mstocks-marquee flex w-max">
            {items(false)}
            {items(true)}
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" aria-labelledby="features-heading" className="px-6 md:px-12 py-24 scroll-mt-6">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeading
          id="features-heading"
          kicker="Why mstocks"
          title="Privacy Is the Product"
          sub="Everything a legacy exchange knows about you becomes a zero-knowledge proof here. These are the six pillars."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature, idx) => (
            <article
              key={feature.title}
              className={`group relative ${PANEL} p-6 md:p-8 shadow-[4px_4px_0px_0px_#FFFFFF] hover:shadow-[6px_6px_0px_0px_#10B981] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5`}
            >
              <span aria-hidden className="absolute top-4 right-4 font-mono text-xs font-bold text-zinc-600 group-hover:text-[#10B981] transition-colors">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <div className="w-12 h-12 mb-6 border-2 border-white bg-[#A855F7] text-white flex items-center justify-center shadow-[2px_2px_0px_0px_#FFFFFF] transition-colors group-hover:bg-white group-hover:text-[#A855F7]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" aria-hidden>
                  {feature.icon}
                </svg>
              </div>
              <h3 className="text-xl font-black capitalize text-white mb-3 tracking-wide">{feature.title}</h3>
              <p className="text-sm text-zinc-300 leading-relaxed font-medium">{feature.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-heading" className="px-6 md:px-12 py-24 border-t-2 border-white scroll-mt-6">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeading
          id="how-heading"
          kicker="The Flow"
          title="Four Steps. Zero Leaks."
          sub="Each step maps to a real circuit in the deployed Compact contract — you can read every line of it."
        />
        <ol className="relative grid gap-10 md:grid-cols-4 md:gap-8">
          <div aria-hidden className="hidden md:block absolute top-6 left-6 right-6 border-t-2 border-dashed border-white/25" />
          {STEPS.map((step, idx) => (
            <li key={step.title} className="relative">
              <div className="w-12 h-12 mb-5 flex items-center justify-center bg-[#A855F7] border-2 border-white shadow-[3px_3px_0px_0px_#FFFFFF] font-black text-white text-lg">
                {idx + 1}
              </div>
              <h3 className="text-lg font-black capitalize text-white mb-2 tracking-wide">{step.title}</h3>
              <p className="text-sm text-zinc-300 leading-relaxed font-medium mb-3">{step.desc}</p>
              <code className="inline-block px-2 py-1 bg-[#0A0A0C] border border-white/40 font-mono text-xs text-[#10B981] whitespace-nowrap">
                {step.chip}
              </code>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StatsBand() {
  return (
    <section aria-label="mstocks by the numbers" className="px-6 md:px-12 pb-24">
      <div className="max-w-[1200px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
        {STATS.map((stat, i) => (
          <div
            key={stat.label}
            className={`${PANEL} p-6 text-center ${i % 2 === 0 ? 'shadow-[4px_4px_0px_0px_#A855F7]' : 'shadow-[4px_4px_0px_0px_#10B981]'}`}
          >
            <div className="text-4xl md:text-5xl font-black text-white mb-2">{stat.value}</div>
            <div className="font-mono text-xs capitalize tracking-wider text-zinc-400">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Simulator() {
  const [side, setSide] = useState('BUY');
  const [ticker, setTicker] = useState('AAPL');
  const [price, setPrice] = useState(MARKET_PRICES.AAPL);
  const [qty, setQty] = useState('10');
  const { sim, run, reset } = useZkSimulation();

  const validation = useMemo(() => {
    const p = Number.parseFloat(price);
    const q = Number.parseInt(qty, 10);
    if (!Number.isFinite(p) || p <= 0) return { ok: false, reason: 'Enter a price above 0.' };
    if (!Number.isInteger(q) || q < 1) return { ok: false, reason: 'Enter a whole quantity of at least 1.' };
    if (q > 1_000_000_000 || p > 1_000_000_000) {
      return { ok: false, reason: 'Contract bounds: qty and price ≤ 1,000,000,000.' };
    }
    const notional = q * p;
    if (side === 'BUY' && notional > DEMO_WALLET.cash) {
      return { ok: false, reason: `Insufficient private cash — demo wallet holds ${DEMO_WALLET.cash.toLocaleString()}.` };
    }
    if (side === 'SELL' && q > DEMO_WALLET.shares) {
      return { ok: false, reason: `Insufficient private stock — demo wallet holds ${DEMO_WALLET.shares.toLocaleString()} shares of each ticker.` };
    }
    return { ok: true, notional };
  }, [price, qty, side]);

  const running = sim.status === 'running';
  const canRun = validation.ok && !running;
  const notionalLabel =
    validation.ok && validation.notional != null
      ? `$${validation.notional.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—';

  const start = () => {
    if (!canRun) return;
    run({
      side,
      ticker,
      qty: Number.parseInt(qty, 10),
      price: Number.parseFloat(price),
      notional: validation.notional,
    });
  };

  const onTickerChange = (e) => {
    const next = e.target.value;
    setTicker(next);
    setPrice(MARKET_PRICES[next] ?? price);
  };

  return (
    <section id="simulator" aria-labelledby="sim-heading" className="px-6 md:px-12 py-24 border-t-2 border-white scroll-mt-6">
      <div className="max-w-[1000px] mx-auto">
        <SectionHeading
          id="sim-heading"
          kicker="Interactive"
          title="Watch an Order Get Shielded"
          sub="This mirrors the real placeOrder pipeline — witness collection, circuit loading, local proving, and the single hash that reaches the ledger."
        />

        <div className="grid md:grid-cols-2 gap-8 items-stretch">
          <div className={`${PANEL} p-8 shadow-[4px_4px_0px_0px_#FFFFFF]`}>
            <h3 className="text-xl font-black capitalize tracking-wider mb-6 text-white border-b-2 border-white pb-3">
              Local input
            </h3>

            <div className="space-y-5">
              <div role="group" aria-label="Order side" className="grid grid-cols-2 gap-3">
                {['BUY', 'SELL'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={side === s}
                    disabled={running}
                    onClick={() => setSide(s)}
                    className={`${FOCUS} py-2.5 font-black uppercase tracking-wider text-sm border-2 border-white transition-all ${
                      side === s
                        ? s === 'BUY'
                          ? 'bg-[#A855F7] text-white shadow-[3px_3px_0px_0px_#FFFFFF]'
                          : 'bg-[#10B981] text-[#0A0A0C] shadow-[3px_3px_0px_0px_#FFFFFF]'
                        : 'bg-[#0A0A0C] text-zinc-400 hover:text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="sim-ticker" className="block text-xs font-black capitalize tracking-wider text-zinc-300 mb-2">
                    Asset
                  </label>
                  <div className="relative">
                    <select
                      id="sim-ticker"
                      disabled={running}
                      value={ticker}
                      onChange={onTickerChange}
                      className={`${INPUT} appearance-none pr-8`}
                    >
                      {TICKERS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                      ▼
                    </span>
                  </div>
                </div>
                <div>
                  <label htmlFor="sim-price" className="block text-xs font-black capitalize tracking-wider text-zinc-300 mb-2">
                    Price ($)
                  </label>
                  <input
                    id="sim-price"
                    disabled={running}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="sim-qty" className="block text-xs font-black capitalize tracking-wider text-zinc-300 mb-2">
                    Qty
                  </label>
                  <input
                    id="sim-qty"
                    disabled={running}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className={INPUT}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-2 border-white/30 p-3 font-mono text-xs">
                <span className="capitalize tracking-wider text-zinc-400">Notional</span>
                <span className="font-bold text-white">{notionalLabel}</span>
              </div>
              <p className="font-mono text-[11px] text-zinc-500 leading-relaxed">
                demo wallet · {DEMO_WALLET.cash.toLocaleString()} private cash ·{' '}
                {DEMO_WALLET.shares.toLocaleString()} private shares per ticker — never on-chain
              </p>

              <button
                type="button"
                onClick={start}
                disabled={!canRun}
                className={`${FOCUS} w-full py-3.5 bg-[#A855F7] text-white font-black capitalize tracking-wider text-sm transition-all border-2 border-white shadow-[3px_3px_0px_0px_#FFFFFF] hover:bg-[#10B981] hover:text-[#0A0A0C] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#A855F7] disabled:hover:text-white`}
              >
                {running ? 'Proving…' : 'Simulate ZK Generation →'}
              </button>

              <p aria-live="polite" className={`text-xs font-bold min-h-[1rem] ${validation.ok ? 'text-[#10B981]' : 'text-zinc-400'}`}>
                {validation.ok
                  ? '✓ Order passes the circuit’s private balance check'
                  : !running && (price !== '' || qty !== '')
                    ? `✗ ${validation.reason}`
                    : ''}
              </p>
            </div>
          </div>

          <div
            role="log"
            aria-live="polite"
            aria-label="Proof pipeline output"
            className="bg-[#0A0A0C] border-2 border-white p-8 font-mono flex flex-col min-h-[420px] shadow-[4px_4px_0px_0px_#10B981]"
          >
            {sim.status === 'idle' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-500 space-y-3">
                <div aria-hidden className="text-4xl">🔒</div>
                <p className="text-xs font-bold tracking-wider px-4 leading-relaxed">
                  Configure an order and run the simulation to watch it get shielded.
                </p>
              </div>
            )}

            {(sim.status === 'running' || sim.status === 'done') && (
              <>
                <div className="text-xs space-y-1.5 flex-1 overflow-y-auto">
                  {sim.lines.map((line, i) => (
                    <div key={i} className={line.cls}>
                      <span className="text-zinc-600 mr-2 select-none">{String(i + 1).padStart(2, '0')}</span>
                      {line.text}
                    </div>
                  ))}
                  {sim.status === 'running' && (
                    <div className="text-zinc-300">
                      <span className="text-zinc-600 mr-2 select-none">{String(sim.lines.length + 1).padStart(2, '0')}</span>
                      <span className="animate-pulse">█</span>
                    </div>
                  )}
                </div>

                {sim.status === 'running' && (
                  <div className="mt-5">
                    <div className="flex justify-between text-[10px] capitalize tracking-wider text-zinc-400 mb-1.5">
                      <span>shielding payload…</span>
                      <span>{sim.progress}%</span>
                    </div>
                    <div className="w-full bg-[#12121A] border-2 border-white h-4 p-0.5" role="progressbar" aria-label="Proof generation progress" aria-valuenow={sim.progress} aria-valuemin={0} aria-valuemax={100}>
                      <div className="bg-[#A855F7] h-full transition-all duration-200" style={{ width: `${sim.progress}%` }} />
                    </div>
                  </div>
                )}

                {sim.status === 'done' && sim.proof && (
                  <div className="mt-5 border-t-2 border-white pt-4 text-xs space-y-2">
                    <div className="text-[#10B981] font-black capitalize tracking-wider border-b-2 border-white/20 pb-2 mb-3">
                      ✓ Proof accepted — order shielded
                    </div>
                    <div className="text-zinc-400">
                      <span className="text-zinc-600 font-bold">circuit:</span>{' '}
                      <span className="text-white">{sim.proof.circuit}</span>
                    </div>
                    <div className="text-zinc-400 break-all">
                      <span className="text-zinc-600 font-bold">commitment:</span>{' '}
                      <span className="text-white">{sim.proof.commitment}</span>
                    </div>
                    <div className="text-zinc-400 break-all">
                      <span className="text-zinc-600 font-bold">owner_key:</span>{' '}
                      <span className="text-white">{sim.proof.ownerKey}…</span>
                    </div>
                    <div className="text-zinc-400">
                      <span className="text-zinc-600 font-bold">ledger delta:</span>{' '}
                      <span className="text-[#10B981]">{sim.proof.delta}</span>
                    </div>
                    <div className="text-zinc-400">
                      <span className="text-zinc-600 font-bold">shielded:</span>{' '}
                      <span className="text-[#A855F7] font-bold">🤐 {sim.proof.shielded}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 pt-3 leading-relaxed font-sans">
                      Only the commitment and owner key reach the ledger. The preimage never leaves this device.
                    </p>
                    <button
                      type="button"
                      onClick={reset}
                      className={`${FOCUS} mt-2 px-4 py-2 bg-[#12121A] border-2 border-white text-white font-black capitalize tracking-wider text-xs transition-all hover:bg-[#A855F7] active:translate-x-[2px] active:translate-y-[2px]`}
                    >
                      ↺ Run again
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PrivacyComparison() {
  return (
    <section id="privacy" aria-labelledby="privacy-heading" className="px-6 md:px-12 py-24 border-t-2 border-white scroll-mt-6">
      <div className="max-w-[1000px] mx-auto">
        <SectionHeading
          id="privacy-heading"
          kicker="Transparency Report"
          title="What the World Sees"
          sub="The exact split between public ledger and private state — no marketing asterisks."
        />
        <div className={`${PANEL} shadow-[6px_6px_0px_0px_#A855F7] overflow-x-auto`}>
          <table className="w-full border-collapse text-left min-w-[560px]">
            <thead>
              <tr className="bg-[#A855F7] text-white">
                <th scope="col" className="border-2 border-white p-4 font-black capitalize tracking-wider text-xs">
                  Data
                </th>
                <th scope="col" className="border-2 border-white p-4 font-black capitalize tracking-wider text-xs">
                  Legacy exchange
                </th>
                <th scope="col" className="border-2 border-white p-4 font-black capitalize tracking-wider text-xs">
                  mstocks
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.label} className="align-top">
                  <th scope="row" className="border-2 border-white p-4 text-sm font-bold text-white bg-[#12121A]">
                    {row.label}
                  </th>
                  <td className="border-2 border-white p-4 text-sm text-zinc-400 font-medium bg-[#12121A]">
                    ✗ {row.legacy}
                  </td>
                  <td className="border-2 border-white p-4 text-sm font-bold text-[#10B981] bg-[#10B981]/10">
                    ✓ {row.mstocks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="px-6 md:px-12 py-24 border-t-2 border-white scroll-mt-6">
      <div className="max-w-[800px] mx-auto">
        <SectionHeading
          id="faq-heading"
          kicker="FAQ"
          title="Questions, Answered"
          sub="The honest version — including what stays hidden and what doesn’t."
        />
        <div>
          {FAQS.map((faq) => (
            <details key={faq.q} className="mstocks-faq group bg-[#12121A] border-2 border-white shadow-[4px_4px_0px_0px_#FFFFFF] mb-4 last:mb-0">
              <summary className={`${FOCUS} flex cursor-pointer select-none items-center justify-between gap-4 p-5 font-black capitalize tracking-wide text-sm text-white`}>
                {faq.q}
                <span aria-hidden className="shrink-0 text-[#A855F7] text-lg leading-none transition-transform duration-200 group-open:rotate-90">
                  ▸
                </span>
              </summary>
              <div className="px-5 pb-5 pt-4 text-sm text-zinc-300 leading-relaxed font-medium border-t-2 border-white/10">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section aria-labelledby="cta-heading" className="relative overflow-hidden border-y-2 border-white bg-[#A855F7] px-6 py-20 md:py-28">
      <span
        aria-hidden
        className="absolute right-5 top-5 md:right-12 md:top-10 rotate-6 bg-[#0A0A0C] text-white border-2 border-white px-4 py-2 font-black capitalize text-[10px] md:text-xs tracking-wider shadow-[4px_4px_0px_0px_#FFFFFF]"
      >
        Zero data leakage
      </span>
      <div className="max-w-3xl mx-auto text-center">
        <h2 id="cta-heading" className="text-4xl md:text-6xl font-black capitalize text-white leading-none mb-6">
          Trade Like No One’s Watching
        </h2>
        <p className="text-white/85 font-medium mb-10 max-w-xl mx-auto">
          Because on mstocks, no one is. Fund a private wallet, place your first shielded
          order, and let the chain prove — not trust.
        </p>
        <Link
          to="/trade"
          className={`${FOCUS} inline-flex items-center gap-2 px-8 py-4 bg-white text-[#0A0A0C] font-black capitalize tracking-wider text-base border-2 border-white shadow-[5px_5px_0px_0px_#0A0A0C] transition-all hover:bg-[#0A0A0C] hover:text-white hover:shadow-[5px_5px_0px_0px_#FFFFFF] active:translate-x-1 active:translate-y-1 active:shadow-none`}
        >
          Start Trading
          <span aria-hidden className="font-bold text-xl">→</span>
        </Link>
      </div>
    </section>
  );
}

/* ═════════════════════════════════ Page ═══════════════════════════════════ */

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white flex flex-col selection:bg-[#A855F7] selection:text-white">
      <style>{GLOBAL_CSS}</style>
      <main className="flex-grow">
        <Hero />
        <TickerTape />
        <Features />
        <HowItWorks />
        <StatsBand />
        <Simulator />
        <PrivacyComparison />
        <Faq />
        <CtaBand />
      </main>
    </div>
  );
}