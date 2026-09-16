// frontend/src/components/Navbar.jsx
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  const {
    isConnected,
    userAddress,
    isConnecting,
    hasLace,
    walletName,
    connectWallet,
    disconnectWallet,
  } = useWallet();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Trade', path: '/trade' },
    { name: 'Portfolio', path: '/portfolio' },
    { name: 'Faucet', path: '/faucet' },
  ];

  const isActive = (path) => location.pathname === path;

  const shortAddr = (addr) => {
    if (!addr) return '—';
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleConnect = async () => {
    // Optional: nudge user if Lace is missing
    if (!hasLace) {
      const go = window.confirm(
        'Lace wallet not detected.\n\n' +
          '• Install Lace (Midnight-enabled) to connect for real\n' +
          '• Or click OK to use DevNet mock mode for local testing'
      );
      if (!go) return;
    }
    await connectWallet();
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0A0A0C] border-b-2 border-white selection:bg-[#A855F7] selection:text-white">
      <div className="max-w-[1200px] mx-auto px-6 md:px-12 h-20 flex items-center justify-between">

        {/* LOGO */}
        <Link to="/" className="flex items-center gap-3 group focus:outline-none">
          <div className="w-10 h-10 bg-[#A855F7] border-2 border-white flex items-center justify-center font-black text-xl text-white shadow-[3px_3px_0px_0px_#FFFFFF] group-hover:shadow-[3px_3px_0px_0px_#10B981] group-hover:bg-[#9333EA] transition-all">
            M
          </div>
          <span className="font-black text-2xl tracking-tight uppercase text-white">
            M<span className="text-[#A855F7]">Stocks</span>
          </span>
        </Link>

        {/* DESKTOP NAVIGATION — hidden on the home page */}
        {!isHome && (
          <nav className="hidden md:flex items-center gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 font-black uppercase tracking-wider text-xs border-2 transition-all ${
                  isActive(link.path)
                    ? 'bg-[#A855F7] text-white border-white shadow-[3px_3px_0px_0px_#FFFFFF]'
                    : 'bg-[#1A1A22] text-zinc-300 border-white hover:bg-white hover:text-[#0A0A0C] shadow-[2px_2px_0px_0px_#FFFFFF]'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>
        )}

        {/* DESKTOP RIGHT SIDE: Launch App on home, wallet connect elsewhere */}
        <div className="hidden md:flex items-center gap-3">
          {isHome ? (
            <Link
              to="/trade"
              className="px-6 py-2.5 bg-[#A855F7] text-white font-black uppercase tracking-wider text-xs border-2 border-white shadow-[3px_3px_0px_0px_#FFFFFF] hover:bg-[#10B981] hover:text-[#0A0A0C] hover:shadow-[4px_4px_0px_0px_#FFFFFF] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              Launch App
            </Link>
          ) : (
            <>
              {/* Lace status pill */}
              <div
                className={`hidden lg:flex items-center gap-2 px-3 py-1.5 border-2 text-[10px] font-black uppercase tracking-wider ${
                  hasLace
                    ? 'border-[#10B981] text-[#10B981] bg-[#10B981]/10'
                    : 'border-zinc-600 text-zinc-500 bg-[#1A1A22]'
                }`}
              >
                <span className={`w-2 h-2 ${hasLace ? 'bg-[#10B981]' : 'bg-zinc-600'}`} />
                {hasLace ? 'Lace Detected' : 'No Lace'}
              </div>

              {isConnected ? (
                <div className="flex items-center gap-2 border-2 border-white bg-[#1A1A22] p-1.5 shadow-[3px_3px_0px_0px_#FFFFFF]">
                  <div className="flex items-center gap-2 bg-[#0A0A0C] px-3 py-1 border border-zinc-700">
                    <span className="w-2.5 h-2.5 rounded-none bg-[#10B981] animate-pulse" />
                    <div className="flex flex-col leading-none gap-0.5">
                      <span className="font-mono text-xs font-bold text-white">
                        {shortAddr(userAddress)}
                      </span>
                      {walletName && (
                        <span className="text-[9px] font-bold uppercase text-zinc-500">
                          {walletName}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={disconnectWallet}
                    className="px-3 py-1 bg-[#1A1A22] text-zinc-400 hover:text-white font-black text-xs uppercase border border-transparent hover:border-white transition-all"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="px-6 py-2.5 bg-[#A855F7] text-white font-black uppercase tracking-wider text-xs border-2 border-white shadow-[3px_3px_0px_0px_#FFFFFF] hover:bg-[#10B981] hover:text-[#0A0A0C] hover:shadow-[4px_4px_0px_0px_#FFFFFF] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isConnecting ? 'Connecting…' : 'Connect Lace'}
                </button>
              )}
            </>
          )}
        </div>

        {/* MOBILE MENU TOGGLE — hidden on the home page (Launch App is the only action there) */}
        {!isHome && (
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 bg-[#1A1A22] text-white border-2 border-white shadow-[2px_2px_0px_0px_#FFFFFF] focus:outline-none"
            aria-label="Toggle Navigation"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
              {mobileMenuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        )}

        {/* MOBILE: Launch App button on the home page */}
        {isHome && (
          <Link
            to="/trade"
            className="md:hidden px-4 py-2 bg-[#A855F7] text-white font-black uppercase tracking-wider text-xs border-2 border-white shadow-[3px_3px_0px_0px_#FFFFFF] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            Launch App
          </Link>
        )}
      </div>

      {/* MOBILE MENU */}
      {!isHome && mobileMenuOpen && (
        <div className="md:hidden bg-[#1A1A22] border-t-2 border-white p-6 space-y-4 shadow-[0px_8px_0px_0px_#0A0A0C]">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`p-3 font-black uppercase text-sm border-2 ${
                  isActive(link.path)
                    ? 'bg-[#A855F7] text-white border-white shadow-[3px_3px_0px_0px_#FFFFFF]'
                    : 'bg-[#0A0A0C] text-zinc-300 border-white'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="pt-4 border-t-2 border-white">
            {isConnected ? (
              <div className="space-y-3">
                <div className="p-3 bg-[#0A0A0C] border-2 border-white flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase">
                    {walletName || 'Connected'}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#10B981]">
                    {shortAddr(userAddress)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    disconnectWallet();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-3 bg-[#0A0A0C] text-red-400 font-black uppercase text-xs border-2 border-white shadow-[2px_2px_0px_0px_#FFFFFF]"
                >
                  Disconnect Wallet
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  await handleConnect();
                  setMobileMenuOpen(false);
                }}
                disabled={isConnecting}
                className="w-full py-3.5 bg-[#A855F7] text-white font-black uppercase text-xs border-2 border-white shadow-[3px_3px_0px_0px_#FFFFFF] disabled:opacity-60"
              >
                {isConnecting ? 'Connecting…' : 'Connect Lace'}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}