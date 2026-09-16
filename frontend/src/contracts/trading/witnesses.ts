/**
 * MStocks private-state witnesses for the trading contract.
 *
 * The private state (PS) lives in the wallet's private-state provider
 * (encrypted LevelDB in Node, browser storage in a web wallet). It holds:
 *
 *   - cashBalance      test cash in cents (1 USDC = 100 units)
 *   - stockPositions   Ticker enum value -> held quantity
 *   - localSecretKey   32-byte DApp-local secret; the DApp-tagged public key
 *                      hash(getDappPublicKey) is the on-chain identity
 *
 * Every witness returns [newPrivateState, valueForCircuit].
 *
 * This module is environment-agnostic (Node >= 19 and browsers): it only uses
 * globalThis.crypto for randomness.
 */
import type { Ticker, Witnesses } from './contract/index.js';

export interface TradingPrivateState {
  /** Test cash balance in cents. */
  cashBalance: bigint;
  /** Ticker enum value (number) -> held quantity. */
  stockPositions: Record<number, bigint>;
  /** 32-byte DApp-local secret key (hex-encoded for portability). */
  localSecretKey: string;
}

const randomBytes = (n: number): Uint8Array => {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

export const newLocalSecretKey = (): string => toHex(randomBytes(32));

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export const fromHex = (hex: string): Uint8Array => {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
};

/** Fresh private state; called once per wallet when it first joins the DApp. */
export const emptyTradingPrivateState = (): TradingPrivateState => ({
  cashBalance: 0n,
  stockPositions: {},
  localSecretKey: newLocalSecretKey(),
});

const position = (ps: TradingPrivateState, ticker: number): bigint => ps.stockPositions[ticker] ?? 0n;

/**
 * A fresh random order salt, kept below 2^63 so it always lands inside the
 * Compact native field (which must accommodate every Uint<64> value).
 */
const orderSalt = (): bigint => {
  const bytes = randomBytes(8);
  bytes[0] &= 0x7f;
  let value = 0n;
  for (const b of bytes) value = (value << 8n) | BigInt(b);
  return value;
};

export const createWitnesses = (): Witnesses<TradingPrivateState> => ({
  getPrivateBalance: (ctx) => [ctx.privateState, ctx.privateState.cashBalance],

  getPrivateStockPosition: (ctx, ticker) => [ctx.privateState, position(ctx.privateState, ticker)],

  getOrderSalt: (ctx) => [ctx.privateState, orderSalt()],

  getLocalSecretKey: (ctx) => [ctx.privateState, fromHex(ctx.privateState.localSecretKey)],

  creditPrivateCash: (ctx, amount) => {
    const cashBalance = ctx.privateState.cashBalance + amount;
    return [{ ...ctx.privateState, cashBalance }, cashBalance];
  },

  debitPrivateCash: (ctx, amount) => {
    // The circuit asserts sufficiency (balance >= notional) before calling.
    const cashBalance = ctx.privateState.cashBalance - amount;
    return [{ ...ctx.privateState, cashBalance }, cashBalance];
  },

  creditPrivateStock: (ctx, ticker, quantity) => {
    const updated = position(ctx.privateState, ticker) + quantity;
    return [
      { ...ctx.privateState, stockPositions: { ...ctx.privateState.stockPositions, [ticker]: updated } },
      updated,
    ];
  },

  debitPrivateStock: (ctx, ticker, quantity) => {
    const updated = position(ctx.privateState, ticker) - quantity;
    return [
      { ...ctx.privateState, stockPositions: { ...ctx.privateState.stockPositions, [ticker]: updated } },
      updated,
    ];
  },

  getCurrentTimestamp: (ctx) => [ctx.privateState, BigInt(Math.floor(Date.now() / 1000))],

  // Testnet placeholder: production would verify a Turnstile/oracle signature.
  getVerificationVoucher: (ctx) => [ctx.privateState, new Uint8Array(64)],
});
