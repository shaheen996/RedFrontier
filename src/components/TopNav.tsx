import React from 'react';
import { Menu, Moon, Sparkles, Sun, X } from 'lucide-react';
import type { WorkspaceMode } from '../types/mars';

interface TopNavProps {
  activeMode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenAIAnalyst: () => void;
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

const NAV_ITEMS: { id: WorkspaceMode; label: string }[] = [
  { id: 'explore', label: 'Explore' },
  { id: 'science', label: 'Science' },
  { id: 'planner', label: 'Mission Planner' },
  { id: 'data', label: 'Data Explorer' },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeMode,
  onModeChange,
  isDark,
  onToggleTheme,
  onOpenAIAnalyst,
  isMobileMenuOpen,
  onToggleMobileMenu,
}) => {
  return (
    <header className="h-12 shrink-0 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#060A14] px-4 lg:px-5 flex items-center justify-between gap-8">
      {/* Zone 1: Brand Identity */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-label="Toggle exploration panel"
          className="lg:hidden flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
        >
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => onModeChange('explore')}
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-[#E05A2B] rounded-sm"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle cx="12" cy="12" r="6.5" fill="#E05A2B" />
            <path
              d="M3 14.5C5.2 18.2 11.4 18.9 16.9 16.1C20.2 14.4 22.1 11.8 21.8 9.8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="text-slate-900 dark:text-slate-200"
            />
            <circle cx="19.5" cy="9" r="1.5" fill="#38BDF8" />
          </svg>
          <span className="font-display text-base font-bold tracking-wide text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
            Martian Map
          </span>
        </button>
      </div>

      {/* Zone 2: Primary Navigation */}
      <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
        {NAV_ITEMS.map((item) => {
          const isActive = activeMode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onModeChange(item.id)}
              className={`relative py-3 text-xs font-medium tracking-wide whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#E05A2B] ${
                isActive
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {item.label}
              <span
                className={`absolute inset-x-0 bottom-0 h-0.5 transition-opacity duration-150 ${
                  isActive ? 'bg-[#E05A2B] opacity-100' : 'bg-transparent opacity-0'
                }`}
              />
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Theme Control & Primary AI Action */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 dark:border-slate-800/90 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors"
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={onOpenAIAnalyst}
          className="flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md bg-[#E05A2B] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#C84B20] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05A2B]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Analyze Surface
        </button>
      </div>
    </header>
  );
};
