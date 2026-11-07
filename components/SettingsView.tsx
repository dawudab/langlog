import React from 'react';
import { Volume2, EyeOff } from 'lucide-react';

interface SettingsViewProps {
  clozeMode: boolean;
  onToggleClozeMode: (next: boolean) => void;
  autoPlayAudio: boolean;
  onToggleAutoPlayAudio: (next: boolean) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  clozeMode,
  onToggleClozeMode,
  autoPlayAudio,
  onToggleAutoPlayAudio,
}) => {
  return (
    <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2D9C5] p-6 space-y-5">
      <div>
        <h2 className="font-serif-notebook text-lg font-bold text-[#2C2A29]">
          Study Settings
        </h2>
        <p className="text-xs text-[#7A7267] mt-0.5">
          Configure flashcard behavior and audio playback.
        </p>
      </div>

      <div className="divide-y divide-[#EAE2D1]">
        {/* Cloze Deletion Toggle (Default: ON) */}
        <div className="py-4 first:pt-1 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#F3EDE0] text-[#2D5A3C] shrink-0 mt-0.5">
              <EyeOff className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#2C2A29]">
                Cloze Deletion Mode
              </p>
              <p className="text-xs text-[#6E665E] mt-0.5">
                Blank out the target Fusha word inside the context sentence until revealed.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={clozeMode}
            onClick={() => onToggleClozeMode(!clozeMode)}
            className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              clozeMode
                ? 'bg-[#2D5A3C] text-[#FDFBF7]'
                : 'bg-[#EFE9DD] text-[#5C554D] hover:text-[#2C2A29]'
            }`}
          >
            {clozeMode ? 'On' : 'Off'}
          </button>
        </div>

        {/* Auto-Play Audio Toggle */}
        <div className="py-4 last:pb-1 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#F3EDE0] text-[#C87D28] shrink-0 mt-0.5">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#2C2A29]">
                Auto-Play Fusha Audio
              </p>
              <p className="text-xs text-[#6E665E] mt-0.5">
                Automatically pronounce the word and sentence when a flashcard appears.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={autoPlayAudio}
            onClick={() => onToggleAutoPlayAudio(!autoPlayAudio)}
            className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              autoPlayAudio
                ? 'bg-[#2D5A3C] text-[#FDFBF7]'
                : 'bg-[#EFE9DD] text-[#5C554D] hover:text-[#2C2A29]'
            }`}
          >
            {autoPlayAudio ? 'On' : 'Off'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
