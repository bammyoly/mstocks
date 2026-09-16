// frontend/src/context/WalletContext.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';
import {
  TRADING_CONTRACT_ADDRESS,
  TRADING_PRIVATE_STATE_ID,
  TRADING_INDEXER_URL,
  TRADING_INDEXER_WS,
  TRADING_PROOF_SERVER_URL,
  TRADING_NETWORK,
  TRADING_FAUCET_URL,
} from '../contracts/trading/config';
import {
  Ticker,
  initialPrivateState,
  createWitnesses,
  FAUCET_AMOUNT_USD,
  FAUCET_COOLDOWN_SECS,
} from '../lib/privateState';

if (typeof BigInt.prototype.toJSON !== 'function') {
  BigInt.prototype.toJSON = function () {
    return { __type: 'bigint', value: this.toString() };
  };
}

const WalletContext = createContext(null);

const LS_PREFIX = 'mstocks_ps_v6_';
const LS_LAST_ID = 'mstocks_last_wallet_id_v6';

function stringifyWithBigInt(obj) {
  return JSON.stringify(obj, (_k, v) =>
    typeof v === 'bigint' ? { __type: 'bigint', value: v.toString() } : v
  );
}

function parseWithBigInt(raw) {
  if (!raw) return null;
  return JSON.parse(raw, (_k, v) => {
    if (v && typeof v === 'object' && v.__type === 'bigint') return BigInt(v.value);
    return v;
  });
}

function emptyPrivateState() {
  return {
    ...initialPrivateState,
    cashBalance: 0,
    positions: { ...(initialPrivateState.positions || {}) },
    orders: [],
    trades: [],
    isVerified: false,
    lastFaucetClaimAt: 0,
    secretKeyHex: null,
  };
}

function normalizeId(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (value instanceof Uint8Array || ArrayBuffer.isView(value)) {
    return Array.from(value)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toLowerCase();
  }
  if (typeof value === 'object') {
    if (value.value != null) return normalizeId(value.value);
    if (value.bytes != null) return normalizeId(value.bytes);
    if (typeof value.asString === 'function') return normalizeId(value.asString());
    if (typeof value.toString === 'function') {
      const s = value.toString();
      if (s && s !== '[object Object]') return s.trim().toLowerCase();
    }
  }
  return String(value).trim().toLowerCase();
}

function lsKeyFor(storageId) {
  if (!storageId) return null;
  return `${LS_PREFIX}${storageId}`;
}

function loadPrivateFor(storageId) {
  if (!storageId) return emptyPrivateState();
  try {
    const raw = localStorage.getItem(lsKeyFor(storageId));
    if (!raw) return emptyPrivateState();
    const p = parseWithBigInt(raw);
    return {
      ...emptyPrivateState(),
      ...p,
      cashBalance: Number(p?.cashBalance ?? 0),
      positions: {
        ...emptyPrivateState().positions,
        ...(p?.positions || {}),
      },
      orders: Array.isArray(p?.orders) ? p.orders : [],
      trades: Array.isArray(p?.trades) ? p.trades : [],
      isVerified: Boolean(p?.isVerified),
      lastFaucetClaimAt: Number(p?.lastFaucetClaimAt || 0),
      secretKeyHex: p?.secretKeyHex || null,
    };
  } catch (e) {
    console.warn('[wallet] loadPrivateFor failed', e);
    return emptyPrivateState();
  }
}

function savePrivateFor(storageId, state) {
  if (!storageId || !state) return;
  try {
    localStorage.setItem(lsKeyFor(storageId), stringifyWithBigInt(state));
    localStorage.setItem(LS_LAST_ID, storageId);
  } catch (e) {
    console.warn('[wallet] savePrivateFor failed', e);
  }
}

/**
 * Stable id for THIS browser wallet so reconnect restores the same private state.
 * Prefer coinPublicKey (stable), then bech32/shield address. Never Date.now().
 */
function resolveWalletIdentity(api, st) {
  const candidates = [
    st?.coinPublicKey,
    st?.address,
    st?.shieldedAddress,
    st?.unshieldedAddress,
    st?.coinPublicKey?.value,
  ];

  let displayAddress = '';
  let storageId = '';

  for (const c of candidates) {
    const n = normalizeId(c);
    if (!n || n.length < 8) continue;
    if (!displayAddress && typeof c === 'string' && c.length > 10) {
      displayAddress = c;
    }
    // Prefer long hex-like keys for storage
    if (!storageId) storageId = n;
    if (/^[0-9a-f]{32,}$/i.test(n)) {
      storageId = n;
      break;
    }
  }

  if (!storageId && displayAddress) storageId = normalizeId(displayAddress);
  if (!displayAddress && storageId) displayAddress = storageId;

  // Last resort: fixed mock id (stable across reloads — NOT Date.now())
  if (!storageId) {
    storageId = 'mock_devnet_wallet_v1';
    displayAddress = displayAddress || 'mn_lace1qdevnetdemoaddress0001';
  }

  return { storageId, displayAddress };
}

function findInjectedWallet() {
  if (typeof window === 'undefined') return null;
  if (window.midnight?.mnLace) {
    return { name: 'Midnight Lace', provider: window.midnight.mnLace };
  }
  if (window.cardano?.lace) {
    return { name: 'Lace', provider: window.cardano.lace };
  }
  if (window.midnight?.lace) {
    return { name: 'Lace', provider: window.midnight.lace };
  }
  return null;
}

export function WalletProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState(null);
  const [storageId, setStorageId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasLace, setHasLace] = useState(false);
  const [walletName, setWalletName] = useState(null);
  const [error, setError] = useState(null);
  const [contract, setContract] = useState(null);
  const [privateState, setPrivateState] = useState(() => emptyPrivateState());

  const privateStateRef = useRef(privateState);
  const storageIdRef = useRef(null);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    privateStateRef.current = privateState;
  }, [privateState]);

  useEffect(() => {
    storageIdRef.current = storageId;
  }, [storageId]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Persist whenever connected state changes
  useEffect(() => {
    if (!isConnected || !storageId) return;
    savePrivateFor(storageId, privateState);
  }, [privateState, isConnected, storageId]);

  useEffect(() => {
    const check = () => {
      if (findInjectedWallet()) setHasLace(true);
    };
    check();
    const t1 = setTimeout(check, 500);
    const t2 = setTimeout(check, 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // ─── Gated public API ─────────────────────────────────────
  const usdcBalance = isConnected ? Number(privateState.cashBalance || 0) : 0;

  const setUsdcBalance = useCallback((updater) => {
    if (!isConnectedRef.current) return;
    setPrivateState((prev) => {
      const cur = Number(prev.cashBalance || 0);
      const next = typeof updater === 'function' ? updater(cur) : Number(updater);
      return { ...prev, cashBalance: next };
    });
  }, []);

  const setPrivateStateGuarded = useCallback((updater) => {
    if (!isConnectedRef.current) {
      console.warn('[wallet] setPrivateState ignored (disconnected)');
      return;
    }
    setPrivateState(updater);
  }, []);

  const isVerified = isConnected ? Boolean(privateState.isVerified) : false;
  const lastFaucetClaimAt = isConnected ? Number(privateState.lastFaucetClaimAt || 0) : 0;

  const faucetStatus = useMemo(() => {
    if (!isConnected) {
      return { canClaim: false, remainingSecs: 0, nextClaimAt: 0 };
    }
    const now = Math.floor(Date.now() / 1000);
    if (!lastFaucetClaimAt) {
      return { canClaim: true, remainingSecs: 0, nextClaimAt: 0 };
    }
    const next = lastFaucetClaimAt + FAUCET_COOLDOWN_SECS;
    const remaining = Math.max(0, next - now);
    return {
      canClaim: remaining === 0,
      remainingSecs: remaining,
      nextClaimAt: next,
    };
  }, [isConnected, lastFaucetClaimAt, privateState.cashBalance]);

  const portfolioStats = useMemo(() => {
    const stats = {};
    Object.values(Ticker).forEach((t) => {
      stats[t] = { avgEntry: 0, currentQty: 0, realizedPnL: 0 };
    });
    let totalRealized = 0;

    if (!isConnected) {
      return { tickerStats: stats, totalRealized: 0, enrichedTrades: [] };
    }

    const reversed = [...(privateState.trades || [])].reverse();
    const enrichedTrades = reversed
      .map((trade) => {
        const t = trade.ticker;
        if (!stats[t]) stats[t] = { avgEntry: 0, currentQty: 0, realizedPnL: 0 };
        const s = stats[t];
        let tradePnL = 0;
        const qty = Number(trade.quantity);
        const px = Number(trade.price);

        if (trade.isBuy) {
          const newQty = s.currentQty + qty;
          if (newQty > 0) {
            s.avgEntry = (s.avgEntry * s.currentQty + px * qty) / newQty;
          }
          s.currentQty = newQty;
        } else {
          tradePnL = (px - s.avgEntry) * qty;
          s.realizedPnL += tradePnL;
          totalRealized += tradePnL;
          s.currentQty = Math.max(0, s.currentQty - qty);
          if (s.currentQty === 0) s.avgEntry = 0;
        }
        return { ...trade, pnl: tradePnL, avgEntryAtTrade: s.avgEntry };
      })
      .reverse();

    return { tickerStats: stats, totalRealized, enrichedTrades };
  }, [isConnected, privateState.trades]);

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const found = findInjectedWallet();
      let api = null;
      let name = 'DevNet Mock';
      let st = null;

      if (found?.provider) {
        name = found.name;
        api =
          typeof found.provider.enable === 'function'
            ? await found.provider.enable()
            : found.provider;
        st = typeof api.state === 'function' ? await api.state() : null;
      }

      const { storageId: sid, displayAddress } = resolveWalletIdentity(api, st);

      // CRITICAL: load persisted state for THIS wallet before showing UI
      const loaded = loadPrivateFor(sid);
      console.log('[wallet] connect', {
        storageId: sid,
        displayAddress,
        cash: loaded.cashBalance,
        verified: loaded.isVerified,
        lastFaucet: loaded.lastFaucetClaimAt,
        positions: loaded.positions,
      });

      privateStateRef.current = loaded;
      storageIdRef.current = sid;
      setStorageId(sid);
      setPrivateState(loaded);
      setUserAddress(displayAddress);
      setWalletName(name);
      setIsConnected(true);
      isConnectedRef.current = true;

      // Join contract (optional — failure stays in simulation mode with same private state)
      if (api) {
        try {
          const { findDeployedContract } = await import(
            '@midnight-ntwrk/midnight-js-contracts'
          );
          const { indexerPublicDataProvider } = await import(
            '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
          );
          const { httpClientProofProvider } = await import(
            '@midnight-ntwrk/midnight-js-http-client-proof-provider'
          );
          const { FetchZkConfigProvider } = await import(
            '@midnight-ntwrk/midnight-js-fetch-zk-config-provider'
          );

          const witnesses = createWitnesses(
            () => privateStateRef.current,
            (next) => {
              privateStateRef.current = next;
              setPrivateState(next);
              if (storageIdRef.current) {
                savePrivateFor(storageIdRef.current, next);
              }
            }
          );

          const privateStateProvider = {
            async get(key) {
              const item = localStorage.getItem(`mn_contract_ps_${sid}_${key}`);
              return item ? parseWithBigInt(item) : null;
            },
            async set(key, state) {
              localStorage.setItem(
                `mn_contract_ps_${sid}_${key}`,
                stringifyWithBigInt(state)
              );
            },
            async remove(key) {
              localStorage.removeItem(`mn_contract_ps_${sid}_${key}`);
            },
          };

          const providers = {
            privateStateProvider,
            publicDataProvider: indexerPublicDataProvider(
              TRADING_INDEXER_URL,
              TRADING_INDEXER_WS
            ),
            zkConfigProvider: new FetchZkConfigProvider(
              `${window.location.origin}/src/contracts/trading/`
            ),
            proofProvider: httpClientProofProvider(TRADING_PROOF_SERVER_URL),
            walletProvider: api,
            midnightProvider: api,
          };

          const { Contract } = await import(
            '../contracts/trading/contract/index.js'
          );

          const instance = await findDeployedContract(providers, {
            contractAddress: TRADING_CONTRACT_ADDRESS,
            privateStateId: TRADING_PRIVATE_STATE_ID,
            contract: new Contract(witnesses),
            initialPrivateState: {},
          });

          setContract(instance);
          toast.success('Wallet connected · contract ready');
        } catch (e) {
          console.warn('[wallet] contract join failed:', e);
          setContract(null);
          toast('Connected (simulation mode)', { icon: '⚠️' });
        }
      } else {
        setContract(null);
        toast.success('Mock wallet connected');
      }

      // Ensure disk has latest after connect
      savePrivateFor(sid, privateStateRef.current);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Connection failed');
      setIsConnected(false);
      isConnectedRef.current = false;
      setUserAddress(null);
      setStorageId(null);
      storageIdRef.current = null;
      setWalletName(null);
      setContract(null);
      privateStateRef.current = emptyPrivateState();
      setPrivateState(emptyPrivateState());
      toast.error(err?.message || 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    const sid = storageIdRef.current;
    const snap = privateStateRef.current;

    // ALWAYS flush before clearing memory
    if (sid) {
      savePrivateFor(sid, snap);
      console.log('[wallet] disconnect save', {
        storageId: sid,
        cash: snap.cashBalance,
        verified: snap.isVerified,
        lastFaucet: snap.lastFaucetClaimAt,
      });
    }

    setIsConnected(false);
    isConnectedRef.current = false;
    setUserAddress(null);
    setStorageId(null);
    storageIdRef.current = null;
    setWalletName(null);
    setContract(null);
    setError(null);

    // UI only — disk still has the wallet snapshot
    privateStateRef.current = emptyPrivateState();
    setPrivateState(emptyPrivateState());

    toast.success('Wallet disconnected');
  }, []);

  const verifyWalletOnChain = useCallback(async () => {
    if (!isConnectedRef.current) {
      await connectWallet();
      return;
    }

    const run = (async () => {
      if (contract?.callTx?.verifyWallet) {
        await contract.callTx.verifyWallet();
      } else {
        await new Promise((r) => setTimeout(r, 1000));
      }

      setPrivateState((s) => {
        const next = { ...s, isVerified: true };
        privateStateRef.current = next;
        if (storageIdRef.current) savePrivateFor(storageIdRef.current, next);
        return next;
      });
    })();

    return toast.promise(run, {
      loading: 'Verifying wallet (ZK)...',
      success: 'Wallet verified',
      error: (e) => e?.message || 'Verification failed',
    });
  }, [connectWallet, contract]);

  const claimFaucetOnChain = useCallback(async () => {
    if (!isConnectedRef.current) {
      await connectWallet();
      return;
    }

    const snap = privateStateRef.current;
    if (!snap.isVerified) {
      toast.error('Verify wallet first');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const last = Number(snap.lastFaucetClaimAt || 0);
    if (last && now - last < FAUCET_COOLDOWN_SECS) {
      const left = FAUCET_COOLDOWN_SECS - (now - last);
      const h = Math.ceil(left / 3600);
      toast.error(`Faucet cooldown: ~${h}h remaining`);
      return;
    }

    const run = (async () => {
      if (contract?.callTx?.claimFaucet) {
        await contract.callTx.claimFaucet();
      } else {
        await new Promise((r) => setTimeout(r, 1200));
      }

      setPrivateState((s) => {
        const next = {
          ...s,
          cashBalance: Number(s.cashBalance || 0) + FAUCET_AMOUNT_USD,
          lastFaucetClaimAt: Math.floor(Date.now() / 1000),
        };
        privateStateRef.current = next;
        if (storageIdRef.current) savePrivateFor(storageIdRef.current, next);
        return next;
      });
    })();

    return toast.promise(run, {
      loading: 'Claiming $1000 shielded USDC...',
      success: 'Faucet claimed · $1000 USDC',
      error: (e) => e?.message || 'Claim failed',
    });
  }, [connectWallet, contract]);

  const visiblePrivateState = useMemo(() => {
    if (!isConnected) return emptyPrivateState();
    return privateState;
  }, [isConnected, privateState]);

  const value = useMemo(
    () => ({
      isConnected,
      userAddress,
      storageId,
      isConnecting,
      hasLace,
      walletName,
      error,
      contract,

      privateState: visiblePrivateState,
      setPrivateState: setPrivateStateGuarded,
      usdcBalance,
      setUsdcBalance,
      isVerified,
      faucetStatus,
      lastFaucetClaimAt,
      portfolioStats,

      connectWallet,
      disconnectWallet,
      verifyWalletOnChain,
      claimFaucetOnChain,

      contractAddress: TRADING_CONTRACT_ADDRESS,
      network: TRADING_NETWORK,
      nightFaucetUrl: TRADING_FAUCET_URL,
    }),
    [
      isConnected,
      userAddress,
      storageId,
      isConnecting,
      hasLace,
      walletName,
      error,
      contract,
      visiblePrivateState,
      setPrivateStateGuarded,
      usdcBalance,
      setUsdcBalance,
      isVerified,
      faucetStatus,
      lastFaucetClaimAt,
      portfolioStats,
      connectWallet,
      disconnectWallet,
      verifyWalletOnChain,
      claimFaucetOnChain,
    ]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}