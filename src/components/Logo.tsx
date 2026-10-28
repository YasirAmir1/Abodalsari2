import React from 'react';

export interface LogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showGlow?: boolean;
  shape?: 'circle' | 'rounded';
  alt?: string;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showGlow = false,
  shape = 'circle',
  alt = 'شعار شركة الساري للبث الأرضي - وكيل قنوات الرابعة الرياضية'
}) => {
  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    '2xl': 'w-32 h-32'
  };

  const roundedMap = {
    circle: 'rounded-full',
    rounded: 'rounded-2xl'
  };

  const dimensions = sizeMap[size] || 'w-11 h-11';
  const shapeClass = roundedMap[shape] || 'rounded-full';

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${dimensions} ${className}`}>
      {/* Optional ambient background glow */}
      {showGlow && (
        <div className="absolute inset-0 bg-sky-500/30 rounded-full blur-md -z-10 animate-pulse pointer-events-none" />
      )}

      {/* Outer border & white canvas container to keep the circular logo pristine on both light & dark backgrounds */}
      <div
        className={`w-full h-full ${shapeClass} overflow-hidden bg-white p-0.5 shadow-sm ring-1 ring-sky-500/20 dark:ring-sky-400/30 transition-transform duration-200 flex items-center justify-center`}
      >
        <img
          src="/logo.png"
          alt={alt}
          loading="eager"
          className="w-full h-full object-contain pointer-events-none select-none"
        />
      </div>
    </div>
  );
};

export default Logo;
