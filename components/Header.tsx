import React from 'react';
import { BookOpen, BookMarked, Layers, UserCheck } from 'lucide-react';
import { AppTab } from '../types';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  wordBankCount: number;
  masteredCount: number;
  onStartNewEntry: () => void;
}

const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  wordBankCount,
  masteredCount,
  onStartNewEntry,
}) => {
  const navItems: Array<{
    id: AppTab;
    label: string;
    mobileLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'journal',
      label: 'Journal',
      mobileLabel: 'Journal',
      icon: <BookOpen className="w-5 h-5" />,
    },
    {
      id: 'wordBank',
      label: wordBankCount > 0 ? `Word Bank (${wordBankCount})` : 'Word Bank',
      mobileLabel: 'Word Bank',
      icon: <BookMarked className="w-5 h-5" />,
    },
    {
      id: 'study',
      label: 'Study',
      mobileLabel: 'Study',
      icon: <Layers className="w-5 h-5" />,
    },
    {
      id: 'profile',
      label: masteredCount > 0 ? `Profile (${masteredCount})` : 'Profile',
      mobileLabel: 'Profile',
      icon: <UserCheck className="w-5 h-5" />,
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 h-16 px-4 sm:px-8 bg-[#FAF7F2]/95 backdrop-blur-xs border-b border-[#E6DEC8] flex items-center justify-between gap-8">
        <a
          href="#journal"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('journal');
          }}
          className="font-serif-notebook text-xl font-bold tracking-tight text-[#2C2A29] whitespace-nowrap shrink-0"
        >
          Fusha Notebook
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#6E665E]">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  isActive
                    ? 'text-[#2C2A29] border-[#2D5A3C] font-semibold'
                    : 'border-transparent hover:text-[#2C2A29]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onStartNewEntry}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#FDFBF7] bg-[#2D5A3C] hover:bg-[#23472F] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            New Entry
          </button>
        </div>
      </header>

      <nav
        aria-label="Primary Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#FAF7F2]/95 backdrop-blur-xs border-t border-[#E6DEC8] grid grid-cols-4 items-center px-2"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
                isActive
                  ? 'text-[#2D5A3C] font-semibold'
                  : 'text-[#7A7267] hover:text-[#2C2A29]'
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
