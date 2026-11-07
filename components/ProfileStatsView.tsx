import React, { useState } from 'react';
import {
  Flame,
  BookOpen,
  Award,
  Layers,
  LogIn,
  LogOut,
  Mail,
} from 'lucide-react';
import { UserStats, WordBankItem, isWordMastered } from '../types';
import SettingsView from './SettingsView';

interface ProfileStatsViewProps {
  stats: UserStats;
  wordBank: WordBankItem[];
  entriesCount: number;
  userEmail: string | null;
  clozeMode: boolean;
  onToggleClozeMode: (next: boolean) => void;
  autoPlayAudio: boolean;
  onToggleAutoPlayAudio: (next: boolean) => void;
  onGoogleSignIn: () => Promise<void>;
  onEmailAuth: (
    email: string,
    password: string,
    isRegistering: boolean
  ) => Promise<void>;
  onSignOut: () => Promise<void>;
}

const ProfileStatsView: React.FC<ProfileStatsViewProps> = ({
  stats,
  wordBank,
  entriesCount,
  userEmail,
  clozeMode,
  onToggleClozeMode,
  autoPlayAudio,
  onToggleAutoPlayAudio,
  onGoogleSignIn,
  onEmailAuth,
  onSignOut,
}) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState<boolean>(false);

  const masteredWords = wordBank.filter((w) => isWordMastered(w));

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || isSubmittingAuth) return;
    setIsSubmittingAuth(true);
    try {
      await onEmailAuth(email.trim(), password, isRegistering);
      setEmail('');
      setPassword('');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-6 pb-28 md:pb-16 space-y-8">
      <div className="pb-5 border-b border-[#E6DEC8]">
        <h1 className="font-serif-notebook text-2xl font-bold text-[#2C2A29]">
          Profile &amp; Settings
        </h1>
      </div>

      {/* 4 Core Notebook Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6">
          <div className="flex items-center justify-between text-xs text-[#7A7267] mb-2">
            <span>Streak</span>
            <Flame className="w-4 h-4 text-[#C87D28]" />
          </div>
          <p className="font-serif-notebook text-3xl font-bold text-[#2C2A29] font-mono-tabular">
            {stats.currentStreak}d
          </p>
        </div>

        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6">
          <div className="flex items-center justify-between text-xs text-[#7A7267] mb-2">
            <span>Mastered (20/20)</span>
            <Award className="w-4 h-4 text-[#2D5A3C]" />
          </div>
          <p className="font-serif-notebook text-3xl font-bold text-[#2D5A3C] font-mono-tabular">
            {masteredWords.length} / {wordBank.length}
          </p>
        </div>

        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6">
          <div className="flex items-center justify-between text-xs text-[#7A7267] mb-2">
            <span>Entries</span>
            <BookOpen className="w-4 h-4 text-[#2D5A3C]" />
          </div>
          <p className="font-serif-notebook text-3xl font-bold text-[#2C2A29] font-mono-tabular">
            {entriesCount}
          </p>
        </div>

        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6">
          <div className="flex items-center justify-between text-xs text-[#7A7267] mb-2">
            <span>Reviews</span>
            <Layers className="w-4 h-4 text-[#C87D28]" />
          </div>
          <p className="font-serif-notebook text-3xl font-bold text-[#2C2A29] font-mono-tabular">
            {stats.totalReviewsCompleted}
          </p>
        </div>
      </div>

      {/* Settings & Account Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <SettingsView
          clozeMode={clozeMode}
          onToggleClozeMode={onToggleClozeMode}
          autoPlayAudio={autoPlayAudio}
          onToggleAutoPlayAudio={onToggleAutoPlayAudio}
        />

        {/* Account Section */}
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6 space-y-5">
          <h2 className="font-serif-notebook text-lg font-bold text-[#2C2A29]">
            Account
          </h2>

          {userEmail ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E2D9C5]">
                <span className="text-xs text-[#7A7267] block">Signed in as</span>
                <p className="text-sm font-semibold text-[#2C2A29] mt-0.5">
                  {userEmail}
                </p>
              </div>

              <button
                type="button"
                onClick={onSignOut}
                className="w-full min-h-[42px] px-4 py-2.5 rounded-xl border border-[#D8CFC0] bg-[#FAF7F2] hover:bg-[#EFE9DD] text-xs font-semibold text-[#2C2A29] transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={onGoogleSignIn}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#2D5A3C] hover:bg-[#23472F] text-xs font-semibold text-[#FDFBF7] transition-colors flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Continue with Google</span>
              </button>

              <form onSubmit={handleEmailSubmit} className="space-y-3 pt-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full min-h-[40px] px-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#E2D9C5] rounded-xl text-[#2C2A29] focus:outline-none focus:border-[#2D5A3C]"
                />

                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full min-h-[40px] px-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#E2D9C5] rounded-xl text-[#2C2A29] focus:outline-none focus:border-[#2D5A3C]"
                />

                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#EFE9DD] hover:bg-[#E2D9C5] text-xs font-semibold text-[#2C2A29] transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-3.5 h-3.5 text-[#2D5A3C]" />
                  <span>{isRegistering ? 'Create Account' : 'Sign In'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsRegistering((prev) => !prev)}
                  className="w-full text-center text-xs text-[#6E665E] hover:text-[#2C2A29] pt-1"
                >
                  {isRegistering
                    ? 'Have an account? Sign In'
                    : 'Need an account? Register'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileStatsView;
