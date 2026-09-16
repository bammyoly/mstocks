import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { FAUCET_AMOUNT_USD, FAUCET_COOLDOWN_SECS } from '../lib/privateState';

function formatCountdown(secs) {
  const s = Math.max(0, secs);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

export default function Faucet() {
  const {
    isConnected,
    connectWallet,
    userAddress,
    usdcBalance,
    isVerified,
    faucetStatus,
    claimFaucetOnChain,
    verifyWalletOnChain,
    nightFaucetUrl,
  } = useWallet();

  const [remaining, setRemaining] = useState(faucetStatus.remainingSecs);

  useEffect(() => {
    setRemaining(faucetStatus.remainingSecs);
    const id = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [faucetStatus.remainingSecs, faucetStatus.nextClaimAt]);

  const canClaim = isVerified && (remaining === 0 || faucetStatus.canClaim);

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white p-4 md:p-6 flex flex-col items-center pt-10 gap-6 font-sans">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">Shielded Faucet</h1>
        <p className="mt-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
          Claim ${FAUCET_AMOUNT_USD} mock USDC every 7 days · Preview · ZK private state
        </p>
      </div>

      <div className="w-full max-w-2xl grid grid-cols-2 gap-4">
        <div className="bg-[#1A1A22] border-2 border-white p-4 shadow-[4px_4px_0px_0px_#FFFFFF]">
          <div className="text-[10px] font-black uppercase text-zinc-500">USDC Balance</div>
          <div className="text-2xl font-mono font-black text-[#A855F7]">
            ${Number(usdcBalance).toLocaleString()}
          </div>
        </div>
        <div className="bg-[#1A1A22] border-2 border-white p-4 shadow-[4px_4px_0px_0px_#FFFFFF]">
          <div className="text-[10px] font-black uppercase text-zinc-500">Verification</div>
          <div className={`text-2xl font-mono font-black ${isVerified ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {isVerified ? 'VERIFIED' : 'REQUIRED'}
          </div>
        </div>
      </div>

      <div className="w-full max-w-2xl bg-[#1A1A22] border-2 border-white shadow-[8px_8px_0px_0px_#A855F7]">
        <div className="p-4 border-b-2 border-white bg-[#0A0A0C] flex justify-between items-center">
          <span className="font-black uppercase">Claim Faucet</span>
          <span className="text-[10px] font-black uppercase px-2 py-1 bg-[#10B981] text-black border border-white">
            claimFaucet
          </span>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-xs font-bold uppercase text-zinc-400 leading-relaxed">
            On-chain circuit credits <span className="text-white">100000 cents</span> ($1000) into your
            private cash witness state. Cooldown is enforced via public{' '}
            <span className="text-white">lastFaucetClaim</span> ({FAUCET_COOLDOWN_SECS}s).
          </p>

          {isConnected && (
            <div className="p-3 border-2 border-dashed border-zinc-600 bg-[#0A0A0C] text-xs font-mono">
              <div className="text-zinc-500 uppercase font-black text-[10px] mb-1">Wallet</div>
              <div className="text-[#10B981] truncate">{userAddress}</div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-[#0A0A0C] border-2 border-white">
            <div>
              <div className="text-[10px] font-black uppercase text-zinc-500">Next claim</div>
              <div className="font-mono font-black text-lg">
                {canClaim ? 'READY' : formatCountdown(remaining)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black uppercase text-zinc-500">Amount</div>
              <div className="font-mono font-black text-lg text-[#A855F7]">${FAUCET_AMOUNT_USD}</div>
            </div>
          </div>

          {!isConnected ? (
            <button
              type="button"
              onClick={connectWallet}
              className="w-full py-4 font-black uppercase border-2 border-white bg-white text-black shadow-[4px_4px_0px_0px_#A855F7]"
            >
              Connect Wallet
            </button>
          ) : !isVerified ? (
            <button
              type="button"
              onClick={verifyWalletOnChain}
              className="w-full py-4 font-black uppercase border-2 border-white bg-[#A855F7] text-white shadow-[4px_4px_0px_0px_#FFFFFF]"
            >
              Verify Wallet First
            </button>
          ) : (
            <button
              type="button"
              disabled={!canClaim}
              onClick={claimFaucetOnChain}
              className={`w-full py-4 font-black uppercase border-2 border-white transition-all ${
                canClaim
                  ? 'bg-[#10B981] text-black shadow-[4px_4px_0px_0px_#FFFFFF] hover:brightness-110'
                  : 'bg-[#0A0A0C] text-zinc-600 cursor-not-allowed border-zinc-700'
              }`}
            >
              {canClaim ? 'Claim $1000 Shielded USDC' : `Cooldown ${formatCountdown(remaining)}`}
            </button>
          )}

          <div className="flex flex-wrap gap-3 text-[10px] font-black uppercase">
            <Link to="/trade" className="px-3 py-2 border-2 border-white hover:bg-white hover:text-black">
              Trade
            </Link>
            <Link to="/portfolio" className="px-3 py-2 border-2 border-white hover:bg-white hover:text-black">
              Portfolio
            </Link>
            <a
              href={nightFaucetUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 border-2 border-zinc-600 text-zinc-400 hover:border-white hover:text-white"
            >
              tNIGHT faucet ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}