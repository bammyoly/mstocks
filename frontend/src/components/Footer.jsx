// frontend/src/components/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="w-full border-t-2 border-white bg-[#0A0A0C] text-white selection:bg-[#A855F7] selection:text-white">
      <div className="mx-auto max-w-[1200px] px-6 md:px-12 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          
          {/* Column 1: Info/Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-4 group inline-flex focus:outline-none">
              <div className="w-9 h-9 bg-[#A855F7] border-2 border-white flex items-center justify-center font-black text-lg text-white shadow-[3px_3px_0px_0px_#FFFFFF] group-hover:bg-[#10B981] group-hover:text-[#0A0A0C] transition-all">
                M
              </div>
              <span className="text-2xl font-black uppercase tracking-tight">
                M<span className="text-[#A855F7]">Stocks</span>
              </span>
            </Link>
            <p className="text-zinc-300 text-sm max-w-sm leading-relaxed mb-6 font-medium">
              A peer-to-peer confidential decentralized trading platform powered by Zero-Knowledge proofs. Trade real equities without relinquishing digital privacy.
            </p>
          </div>

          {/* Column 2: Tech Specs */}
          <div>
            <h4 className="text-[#A855F7] font-black text-sm uppercase tracking-wider mb-4 border-b-2 border-white/20 pb-1">
              Technology
            </h4>
            <ul className="space-y-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
              <li>
                <a 
                  href="https://midnight.network/" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="hover:text-[#10B981] transition-colors"
                >
                  Midnight Network ↗
                </a>
              </li>
              <li><span className="text-zinc-500">Compact Smart Contracts</span></li>
              <li><span className="text-zinc-500">Local ZK Proving</span></li>
              <li><span className="text-zinc-500">Provable Equities API</span></li>
            </ul>
          </div>

          {/* Column 3: Navigation */}
          <div>
            <h4 className="text-[#A855F7] font-black text-sm uppercase tracking-wider mb-4 border-b-2 border-white/20 pb-1">
              Links
            </h4>
            <ul className="space-y-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
              <li>
                <Link to="/" className="hover:text-[#10B981] transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/trade" className="hover:text-[#10B981] transition-colors">
                  Launch Exchange
                </Link>
              </li>
              <li><span className="text-zinc-500 cursor-not-allowed">Developer Portal</span></li>
            </ul>
          </div>

        </div>

        {/* Divider */}
        <div className="my-8 border-t-2 border-white" />

        {/* Copyright & Disclaimer */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-medium text-zinc-400">
          <div className="bg-[#1A1A22] border-2 border-white px-3 py-1.5 shadow-[2px_2px_0px_0px_#FFFFFF] text-white font-bold">
            © {new Date().getFullYear()} MStocks. Built on Midnight Network.
          </div>
          <div className="max-w-md text-center md:text-right leading-relaxed font-mono text-[11px] text-zinc-400">
            DISCLAIMER: Platform operates strictly on developer testnet sandbox environments for educational experimentation. No real monetary transactions.
          </div>
        </div>
      </div>
    </footer>
  );
}