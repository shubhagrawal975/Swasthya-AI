import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code:'en', label:'EN', flag:'🇬🇧', name:'English',  native:'English'    },
  { code:'hi', label:'HI', flag:'🇮🇳', name:'Hindi',    native:'हिंदी'       },
  { code:'mr', label:'MR', flag:'🇮🇳', name:'Marathi',  native:'मराठी'       },
  { code:'bn', label:'BN', flag:'🇧🇩', name:'Bengali',  native:'বাংলা'       },
  { code:'te', label:'TE', flag:'🇮🇳', name:'Telugu',   native:'తెలుగు'      },
  { code:'ta', label:'TA', flag:'🇮🇳', name:'Tamil',    native:'தமிழ்'       },
  { code:'gu', label:'GU', flag:'🇮🇳', name:'Gujarati', native:'ગુજરાતી'    },
  { code:'fr', label:'FR', flag:'🇫🇷', name:'French',   native:'Français'   },
  { code:'ar', label:'AR', flag:'🇸🇦', name:'Arabic',   native:'العربية', rtl:true },
  { code:'sw', label:'SW', flag:'🇰🇪', name:'Swahili',  native:'Kiswahili'  },
];

/**
 * LanguagePill — language switcher
 * @param {boolean} dark     - dark background mode (for dark navbars)
 * @param {boolean} fixed    - if true, positions fixed top-right (legacy behaviour)
 */
export default function LanguagePill({ dark = false, fixed: isFixed = false }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (lang) => {
    i18n.changeLanguage(lang.code);
    document.documentElement.dir = lang.rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang.code;
    setOpen(false);
  };

  const wrapperClass = isFixed ? 'fixed top-3.5 right-3.5 z-50' : 'relative z-50';

  return (
    <div ref={ref} className={wrapperClass}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all"
        style={{
          background: dark ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.92)',
          border: dark ? '1px solid rgba(255,255,255,.2)' : '1px solid #e2e8f0',
          color: dark ? '#fff' : '#374151',
          backdropFilter: 'blur(8px)',
          boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,.08)',
        }}
      >
        <span>{current.flag}</span>
        <span>{current.label}</span>
        <span style={{ color: dark ? 'rgba(255,255,255,.5)' : '#9ca3af', fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div className="absolute top-10 right-0 bg-white border border-gray-100 rounded-2xl shadow-xl min-w-44 overflow-hidden z-50"
          style={{ animation: 'fadeUp .18s ease' }}>
          {LANGUAGES.map(lang => (
            <button key={lang.code} onClick={() => select(lang)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
              style={{
                background: lang.code === i18n.language ? '#f0f9f4' : 'transparent',
                color: lang.code === i18n.language ? '#1a5c3a' : '#374151',
              }}
              onMouseEnter={e => e.currentTarget.style.background = lang.code === i18n.language ? '#f0f9f4' : '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = lang.code === i18n.language ? '#f0f9f4' : 'transparent'}
            >
              <span className="text-base">{lang.flag}</span>
              <div>
                <div className="font-bold text-xs">{lang.name}</div>
                <div className="text-xs" style={{ color: '#9ca3af' }}>{lang.native}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
