
import React from 'react';
import { BookText, ListChecks, Archive } from 'lucide-react';
import { AppView } from '../types';

interface HeaderProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
}

// Specify that icon accepts className
const navItems: { view: AppView; label: string; icon: React.ReactElement<{ className?: string }> }[] = [
  { view: 'journal', label: 'Journal', icon: <BookText /> },
  { view: 'words', label: 'Words', icon: <ListChecks /> },
  { view: 'savedEntries', label: 'Entries', icon: <Archive /> },
];

const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView }) => {
  return (
    <header className="bg-slate-800/60 backdrop-blur-md shadow-lg sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <span className="font-bold text-xl text-sky-400">MyLingoJournal</span>
          </div>
          <nav className="flex space-x-1 sm:space-x-2">
            {navItems.map((navItem) => (
              <button
                key={navItem.view}
                onClick={() => setCurrentView(navItem.view)}
                className={`px-2 py-2 sm:px-3 text-xs sm:text-sm font-medium rounded-md flex items-center transition-colors duration-150 ease-in-out
                  ${currentView === navItem.view
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
              >
                {React.cloneElement(navItem.icon, { className: "h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-1.5 flex-shrink-0" })}
                <span className="hidden sm:inline">{navItem.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
