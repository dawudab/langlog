import React from 'react';
import { BookOpen, Layers, BookMarked, Archive } from 'lucide-react';
import { AppView } from '../types';

interface HeaderProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  dueCardsCount: number;
  pendingSyncCount: number;
  rootsCount: number;
  userEmail: string | null;
  onAuthAction: () => void;
}

const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  dueCardsCount,
  pendingSyncCount,
  rootsCount,
  userEmail,
  onAuthAction,
}) => {
  const navItems: Array<{
    id: AppView;
    label: string;
    mobileLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'journal',
      label: 'Journal',
      mobileLabel: 'Write',
      icon: <BookOpen className="w-5 h-5" />,
    },
    {
      id: 'study',
      label: dueCardsCount > 0 ? `Study SRS (${dueCardsCount})` : 'Study SRS',
      mobileLabel: dueCardsCount > 0 ? `Study (${dueCardsCount})` : 'Study',
      icon: <Layers className="w-5 h-5" />,
    },
    {
      id: 'roots',
      label: rootsCount > 0 ? `Root Lexicon (${rootsCount})` : 'Root Lexicon',
      mobileLabel: 'Roots',
      icon: <BookMarked className="w-5 h-5" />,
    },
    {
      id: 'archive',
      label:
        pendingSyncCount > 0 ? `Archive (${pendingSyncCount})` : 'Archive',
      mobileLabel: 'Archive',
      icon: <Archive className="w-5 h-5" />,
    },
  ];

  return (
    <>
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 h-14 px-4 sm:px-8 bg-[#FAF8F5]/90 dark:bg-[#0B0F17]/90 backdrop-blur-md border-b border-stone-200/80 dark:border-slate-800/80 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#journal"
          onClick={(e) => {
            e.preventDefault();
            setCurrentView('journal');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
        >
          Language Journal
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-400">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  isActive
                    ? 'text-slate-900 dark:text-white border-sky-600 dark:border-sky-400 font-semibold'
                    : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            onClick={onAuthAction}
            className="min-h-[38px] px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {userEmail ? 'Sign Out' : 'Cloud Sign In'}
          </button>
        </div>
      </header>

      {/* Mobile Fixed Bottom Tab Bar (Natural Thumb Zone, >=44px hitboxes) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#FAF8F5]/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-t border-stone-200 dark:border-slate-800 grid grid-cols-4 items-center px-2"
      >
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
                isActive
                  ? 'text-sky-600 dark:text-sky-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {item.icon}
              <span className="text-[11px] tracking-tight mt-1 whitespace-nowrap">
                {item.mobileLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

export default Header;
