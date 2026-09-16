import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum Ticker { AAPL = 0,
                     TSLA = 1,
                     GOOGL = 2,
                     MSFT = 3,
                     AMZN = 4,
                     NVDA = 5,
                     SPY = 6,
                     META = 7,
                     NFLX = 8,
                     AMD = 9
}

export enum OrderSide { BUY = 0, SELL = 1 }

export type Witnesses<PS> = {
  getPrivateBalance(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  getPrivateStockPosition(context: __compactRuntime.WitnessContext<Ledger, PS>,
                          ticker_0: Ticker): [PS, bigint];
  getOrderSalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  getLocalSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  creditPrivateCash(context: __compactRuntime.WitnessContext<Ledger, PS>,
                    amount_0: bigint): [PS, bigint];
  debitPrivateCash(context: __compactRuntime.WitnessContext<Ledger, PS>,
                   amount_0: bigint): [PS, bigint];
  creditPrivateStock(context: __compactRuntime.WitnessContext<Ledger, PS>,
                     ticker_0: Ticker,
                     quantity_0: bigint): [PS, bigint];
  debitPrivateStock(context: __compactRuntime.WitnessContext<Ledger, PS>,
                    ticker_0: Ticker,
                    quantity_0: bigint): [PS, bigint];
  getCurrentTimestamp(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  getVerificationVoucher(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  verifyWallet(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  claimFaucet(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  depositCash(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  mintTestStock(context: __compactRuntime.CircuitContext<PS>,
                ticker_0: Ticker,
                quantity_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  placeOrder(context: __compactRuntime.CircuitContext<PS>,
             side_0: OrderSide,
             ticker_0: Ticker,
             quantity_0: bigint,
             price_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  cancelOrder(context: __compactRuntime.CircuitContext<PS>,
              salt_0: bigint,
              side_0: OrderSide,
              ticker_0: Ticker,
              quantity_0: bigint,
              price_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  executeTrade(context: __compactRuntime.CircuitContext<PS>,
               ticker_0: Ticker,
               tradeQuantity_0: bigint,
               tradePrice_0: bigint,
               buySalt_0: bigint,
               buyQuantity_0: bigint,
               buyPrice_0: bigint,
               sellSalt_0: bigint,
               sellQuantity_0: bigint,
               sellPrice_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  verifyWallet(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  claimFaucet(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  depositCash(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  mintTestStock(context: __compactRuntime.CircuitContext<PS>,
                ticker_0: Ticker,
                quantity_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  placeOrder(context: __compactRuntime.CircuitContext<PS>,
             side_0: OrderSide,
             ticker_0: Ticker,
             quantity_0: bigint,
             price_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  cancelOrder(context: __compactRuntime.CircuitContext<PS>,
              salt_0: bigint,
              side_0: OrderSide,
              ticker_0: Ticker,
              quantity_0: bigint,
              price_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  executeTrade(context: __compactRuntime.CircuitContext<PS>,
               ticker_0: Ticker,
               tradeQuantity_0: bigint,
               tradePrice_0: bigint,
               buySalt_0: bigint,
               buyQuantity_0: bigint,
               buyPrice_0: bigint,
               sellSalt_0: bigint,
               sellQuantity_0: bigint,
               sellPrice_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  verifyWallet(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  claimFaucet(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  depositCash(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  mintTestStock(context: __compactRuntime.CircuitContext<PS>,
                ticker_0: Ticker,
                quantity_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  placeOrder(context: __compactRuntime.CircuitContext<PS>,
             side_0: OrderSide,
             ticker_0: Ticker,
             quantity_0: bigint,
             price_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  cancelOrder(context: __compactRuntime.CircuitContext<PS>,
              salt_0: bigint,
              side_0: OrderSide,
              ticker_0: Ticker,
              quantity_0: bigint,
              price_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  executeTrade(context: __compactRuntime.CircuitContext<PS>,
               ticker_0: Ticker,
               tradeQuantity_0: bigint,
               tradePrice_0: bigint,
               buySalt_0: bigint,
               buyQuantity_0: bigint,
               buyPrice_0: bigint,
               sellSalt_0: bigint,
               sellQuantity_0: bigint,
               sellPrice_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly activeOrderCount: bigint;
  lastPrice: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Ticker): boolean;
    lookup(key_0: Ticker): bigint;
    [Symbol.iterator](): Iterator<[Ticker, bigint]>
  };
  totalVolume: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Ticker): boolean;
    lookup(key_0: Ticker): bigint;
    [Symbol.iterator](): Iterator<[Ticker, bigint]>
  };
  activeOrders: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  verifiedWallets: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  lastFaucetClaim: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
