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

interface ProfileStatsViewProps {
  stats: UserStats;
  wordBank: WordBankItem[];
  entriesCount: number;
  userEmail: string | null;
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
  onGoogleSignIn,
  onEmailAuth,
  onSignOut,
}) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState<boolean>(false);

  const masteredWords = wordBank.filter((w) => isWordMastered(w));
  const almostMasteredWords = wordBank.filter(
    (w) => !isWordMastered(w) && (w.usageCount >= 12 || w.reviewCount >= 12)
  );

  const overallMasteryPct =
    wordBank.length > 0
      ? Math.round((masteredWords.length / wordBank.length) * 100)
      : 0;

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
      {/* Header */}
      <div className="pb-5 border-b border-[#E6DEC8]">
        <h1 className="font-serif-notebook text-2xl sm:text-3xl font-bold text-[#2C2A29]">
          Mastery Progress &amp; Notebook Profile
        </h1>
        <p className="text-xs text-[#6E665E] mt-1">
          Every word used 20 times in your journal and reviewed 20 times in
          context transitions to direct Arabic reading.
        </p>
      </div>

      {/* 4 Core Notebook Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6">
          <div className="flex items-center justify-between text-xs text-[#7A7267] mb-2">
            <span>Journaling Streak</span>
            <Flame className="w-4 h-4 text-[#C87D28]" />
          </div>
          <p className="font-serif-notebook text-3xl font-bold text-[#2C2A29] font-mono-tabular">
            {stats.currentStreak} days
          </p>
          <p className="text-xs text-[#7A7267] mt-1 font-mono-tabular">
            Longest streak: {stats.longestStreak} days
          </p>
        </div>

        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6">
          <div className="flex items-center justify-between text-xs text-[#7A7267] mb-2">
            <span>20/20 Mastered Words</span>
            <Award className="w-4 h-4 text-[#2D5A3C]" />
          </div>
          <p className="font-serif-notebook text-3xl font-bold text-[#2D5A3C] font-mono-tabular">
            {masteredWords.length} / {wordBank.length}
          </p>
          <p className="text-xs text-[#7A7267] mt-1 font-mono-tabular">
            {overallMasteryPct}% direct Fusha immersion
          </p>
        </div>

        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6">
          <div className="flex items-center justify-between text-xs text-[#7A7267] mb-2">
            <span>Notebook Entries</span>
            <BookOpen className="w-4 h-4 text-[#2D5A3C]" />
          </div>
          <p className="font-serif-notebook text-3xl font-bold text-[#2C2A29] font-mono-tabular">
            {entriesCount}
          </p>
          <p className="text-xs text-[#7A7267] mt-1 font-mono-tabular">
            {wordBank.length} unique Fusha words
          </p>
        </div>

        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6">
          <div className="flex items-center justify-between text-xs text-[#7A7267] mb-2">
            <span>Contextual Reviews</span>
            <Layers className="w-4 h-4 text-[#C87D28]" />
          </div>
          <p className="font-serif-notebook text-3xl font-bold text-[#2C2A29] font-mono-tabular">
            {stats.totalReviewsCompleted}
          </p>
          <p className="text-xs text-[#7A7267] mt-1 font-mono-tabular">
            Tri-modal repetitions completed
          </p>
        </div>
      </div>

      {/* Two-Column Split: 20/20 Immersion Milestones & Silent Cloud Account */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left (7 cols): 20/20 Mastery Breakdown */}
        <section className="lg:col-span-7 bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="font-serif-notebook text-xl font-bold text-[#2C2A29]">
              The 20/20 Immersion Rule Progress
            </h2>
            <p className="text-xs text-[#6E665E] mt-1 leading-relaxed">
              Words that reach 20 journal uses and 20 flashcard reviews
              automatically shed their English gloss on your notebook pages so
              you read directly in Fusha Arabic.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-[#2D5A3C]">
              Mastered Vocabulary ({masteredWords.length})
            </h3>
            {masteredWords.length === 0 ? (
              <p className="text-xs text-[#7A7267]">
                No words have reached 20/20 yet. Keep writing and reviewing!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {masteredWords.map((w) => (
                  <div
                    key={w.id}
                    className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E2D9C5] flex items-center justify-between gap-3"
                  >
                    <div>
                      <span
                        dir="rtl"
                        className="font-arabic text-2xl font-bold text-[#2C2A29] block"
                      >
                        {w.arabicWord}
                      </span>
                      <span className="text-xs text-[#6E665E]">
                        {w.englishMeaning}
                      </span>
                    </div>
                    <span className="text-xs font-mono-tabular text-[#2D5A3C] font-semibold">
                      {w.usageCount}/20u · {w.reviewCount}/20r
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {almostMasteredWords.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-[#EAE2D1]">
              <h3 className="text-xs font-semibold text-[#C87D28]">
                Approaching 20/20 Mastery ({almostMasteredWords.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {almostMasteredWords.map((w) => (
                  <div
                    key={w.id}
                    className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E2D9C5] flex items-center justify-between gap-3"
                  >
                    <div>
                      <span
                        dir="rtl"
                        className="font-arabic text-2xl font-bold text-[#2C2A29] block"
                      >
                        {w.arabicWord}
                      </span>
                      <span className="text-xs text-[#6E665E]">
                        {w.englishMeaning}
                      </span>
                    </div>
                    <span className="text-xs font-mono-tabular text-[#C87D28] font-semibold">
                      {w.usageCount}/20u · {w.reviewCount}/20r
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right (5 cols): Firebase Account (Google + Email/Password) */}
        <section className="lg:col-span-5 bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="font-serif-notebook text-xl font-bold text-[#2C2A29]">
              Notebook Account
            </h2>
            <p className="text-xs text-[#6E665E] mt-1 leading-relaxed">
              Sign in with Google or Email to back up your journal pages and
              20/20 Word Bank silently to Cloud Firestore.
            </p>
          </div>

          {userEmail ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E2D9C5]">
                <span className="text-xs text-[#7A7267] block">
                  Signed in as
                </span>
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

              <div className="text-center text-xs text-[#8C8377]">
                or use Email &amp; Password
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#5C554D] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full min-h-[40px] px-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#E2D9C5] rounded-xl text-[#2C2A29] focus:outline-none focus:border-[#2D5A3C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5C554D] mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full min-h-[40px] px-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#E2D9C5] rounded-xl text-[#2C2A29] focus:outline-none focus:border-[#2D5A3C]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#EFE9DD] hover:bg-[#E2D9C5] text-xs font-semibold text-[#2C2A29] transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-3.5 h-3.5 text-[#2D5A3C]" />
                  <span>
                    {isRegistering
                      ? 'Create Email Account'
                      : 'Sign In with Email'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsRegistering((prev) => !prev)}
                  className="w-full text-center text-xs text-[#6E665E] hover:text-[#2C2A29] pt-1"
                >
                  {isRegistering
                    ? 'Already have an account? Sign In'
                    : 'Need an account? Register with Email'}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ProfileStatsView;
