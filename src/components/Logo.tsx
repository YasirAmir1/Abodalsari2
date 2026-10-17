import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const dimensions = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-16 h-16' : 'w-10 h-10';

  return (
    <div className={`relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-blue-700 to-indigo-900 text-white shadow-md ring-2 ring-sky-200 dark:ring-sky-900/60 overflow-hidden shrink-0 ${dimensions} ${className}`}>
      {/* Satellite Dish & TV stylized representation */}
      <div className="absolute inset-0 flex items-center justify-center opacity-90">
        <svg viewBox="0 0 100 100" className="w-4/5 h-4/5 fill-current text-white drop-shadow-sm">
          {/* Satellite Dish Bowl */}
          <ellipse cx="40" cy="45" rx="22" ry="16" transform="rotate(-30 40 45)" fill="currentColor" />
          <ellipse cx="40" cy="45" rx="17" ry="11" transform="rotate(-30 40 45)" fill="#0284c7" />
          {/* Feed horn */}
          <line x1="40" y1="45" x2="52" y2="33" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <circle cx="53" cy="32" r="3" fill="white" />
          {/* Signal Waves */}
          <path d="M 60 25 A 15 15 0 0 1 70 38" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 65 20 A 22 22 0 0 1 80 38" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* TV Screen */}
          <rect x="52" y="42" width="36" height="26" rx="3" fill="#0f172a" stroke="white" strokeWidth="2" />
          <rect x="55" y="45" width="30" height="18" fill="#10b981" rx="1" opacity="0.9" />
          {/* Football Field markings on TV */}
          <ellipse cx="70" cy="54" rx="8" ry="5" stroke="white" strokeWidth="1" fill="none" />
          <line x1="70" y1="45" x2="70" y2="63" stroke="white" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
};
