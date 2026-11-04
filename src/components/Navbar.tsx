import React from 'react';
import { Shield, Sparkles, Plus, ArrowRightLeft } from 'lucide-react';
import { Division } from '../types/hockey';

interface NavbarProps {
  divisions: Division[];
  activeDivisionId: string;
  onSelectDivision: (id: string) => void;
  activeTab: 'predictor' | 'parity' | 'schedule' | 'teams';
  onSelectTab: (tab: 'predictor' | 'parity' | 'schedule' | 'teams') => void;
  onOpenNewDivision: () => void;
  onResetDemoData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  divisions,
  activeDivisionId,
  onSelectDivision,
  activeTab,
  onSelectTab,
  onOpenNewDivision,
  onResetDemoData,
}) => {
  const activeDivision = divisions.find((d) => d.id === activeDivisionId) || divisions[0];

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
      {/* Top Bar Contract: 3 zones separated by gap-8 (Brand Wordmark, Single-line Nav Links, Primary CTA) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Logo */}
        <div className="flex items-center gap-2 shrink-0 bg-transparent p-0 m-0">
          <img 
            src="/assets/aistudio/puckedge-logo-transparent.png" 
            alt="PuckEdge.app - Independent Youth Hockey Scheduling &amp; Parity Tool" 
            loading="eager"
            className="h-10 w-auto bg-transparent mix-blend-multiply drop-shadow-sm object-contain cursor-pointer transition-opacity hover:opacity-95"
          />
        </div>

        {/* Zone 2: 4-5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => onSelectTab('predictor')}
            className={`whitespace-nowrap transition-colors pb-0.5 ${
              activeTab === 'predictor'
                ? 'text-blue-400 font-semibold border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Matchup Predictor
          </button>
          <button
            onClick={() => onSelectTab('parity')}
            className={`whitespace-nowrap transition-colors pb-0.5 ${
              activeTab === 'parity'
                ? 'text-blue-400 font-semibold border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Parity Calculator
          </button>
          <button
            onClick={() => onSelectTab('schedule')}
            className={`whitespace-nowrap transition-colors pb-0.5 ${
              activeTab === 'schedule'
                ? 'text-blue-400 font-semibold border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Schedule Matrix
          </button>
          <button
            onClick={() => onSelectTab('teams')}
            className={`whitespace-nowrap transition-colors pb-0.5 ${
              activeTab === 'teams'
                ? 'text-blue-400 font-semibold border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Team Directory
          </button>
        </nav>

        {/* Zone 3: Primary Action area */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <select
              aria-label="Active Youth Hockey Division"
              value={activeDivisionId}
              onChange={(e) => onSelectDivision(e.target.value)}
              className="bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs text-slate-200 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none font-medium truncate max-w-[200px] sm:max-w-xs cursor-pointer"
            >
              {divisions.map((div) => (
                <option key={div.id} value={div.id}>
                  {div.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>

          <button
            onClick={() => onSelectTab('predictor')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shadow-sm shadow-blue-500/20"
          >
            Simulate Matchup
          </button>
        </div>
      </div>

      {/* Mobile nav strip */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/80 bg-slate-950 px-2 py-2">
        <button
          onClick={() => onSelectTab('predictor')}
          className={`text-xs px-2 py-1 rounded ${activeTab === 'predictor' ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-400'}`}
        >
          Predictor
        </button>
        <button
          onClick={() => onSelectTab('parity')}
          className={`text-xs px-2 py-1 rounded ${activeTab === 'parity' ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-400'}`}
        >
          Parity
        </button>
        <button
          onClick={() => onSelectTab('schedule')}
          className={`text-xs px-2 py-1 rounded ${activeTab === 'schedule' ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-400'}`}
        >
          Schedule
        </button>
        <button
          onClick={() => onSelectTab('teams')}
          className={`text-xs px-2 py-1 rounded ${activeTab === 'teams' ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-400'}`}
        >
          Teams
        </button>
      </div>
    </header>
  );
};
