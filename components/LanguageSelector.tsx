
import React, { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { Language } from '../types';

interface LanguageSelectorProps {
  id: string;
  label: string;
  selectedValue: string;
  onChange: (value: string) => void;
  languages: Language[];
  disabled?: boolean;
  showFlags?: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  id,
  label,
  selectedValue,
  onChange,
  languages,
  disabled = false,
  showFlags = false
}) => {
  const selectedLanguage = useMemo(() => 
    languages.find(lang => lang.code === selectedValue) || languages[0],
    [languages, selectedValue]
  );

  const isRtl = selectedLanguage?.code === 'ar';
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">
        {label}:
      </label>
      <div className="relative">
        <select
          id={id}
          value={selectedValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          dir={isRtl ? 'rtl' : 'ltr'}
          className={`w-full p-3 bg-slate-700 border border-slate-600 rounded-lg appearance-none focus:ring-2 focus:ring-sky-500 text-slate-100 ${isRtl ? 'pr-3 pl-10' : 'pl-3 pr-10'} disabled:opacity-70 disabled:cursor-not-allowed`}
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code} dir={lang.code === 'ar' ? 'rtl' : 'ltr'}>
              {showFlags && (
                <span className="mr-2">
                  {lang.code === 'en' ? '🇬🇧' : '🇸🇦'}
                </span>
              )}
              {lang.name}
            </option>
          ))}
        </select>
        <ChevronDown 
          className={`absolute top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none ${isRtl ? 'left-3' : 'right-3'}`} 
        />
      </div>
    </div>
  );
};

export default LanguageSelector;
