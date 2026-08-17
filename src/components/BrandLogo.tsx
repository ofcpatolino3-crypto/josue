import React from 'react';

interface PortalLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  withText?: boolean;
  textColor?: string;
  variant?: 'dark' | 'light' | 'gold';
}

/**
 * Foto 2: Official circular Logo Icon of Portal Concursos e OAB
 * - Navy circular swirl outer ring
 * - Blue (left) and Red (right) angled book pages / flags in the center
 * - Crisp white negative space
 */
export const PortalLogo: React.FC<PortalLogoProps> = ({
  size = 'md',
  className = '',
  withText = false,
  textColor = '#EDE6D6',
  variant = 'dark',
}) => {
  let dimension = 40;
  if (typeof size === 'number') {
    dimension = size;
  } else {
    switch (size) {
      case 'xs':
        dimension = 24;
        break;
      case 'sm':
        dimension = 32;
        break;
      case 'md':
        dimension = 42;
        break;
      case 'lg':
        dimension = 56;
        break;
      case 'xl':
        dimension = 80;
        break;
    }
  }

  const svgIcon = (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 drop-shadow-sm ${className}`}
      aria-label="Portal Concursos e OAB Logo"
    >
      {/* Outer Glow / Soft Halo */}
      <circle cx="100" cy="100" r="95" fill="white" className="drop-shadow-md" />

      {/* Main Outer Navy Swirl Ring (Foto 2) */}
      <path
        d="M100 12C51.4 12 12 51.4 12 100C12 148.6 51.4 188 100 188C148.6 188 188 148.6 188 100C188 51.4 148.6 12 100 12ZM100 162C65.8 162 38 134.2 38 100C38 65.8 65.8 38 100 38C134.2 38 162 65.8 162 100C162 134.2 134.2 162 100 162Z"
        fill="#0D1B3E"
      />

      {/* Swirling Dynamic Swooshes on the ring to match exact Foto 2 icon */}
      <path
        d="M152 48C168 62 178 80 178 100C178 143.1 143.1 178 100 178C72 178 47 163 33 140C45 158 68 170 94 170C132.7 170 164 138.7 164 100C164 79 154 61 139 49L152 48Z"
        fill="#071026"
      />
      <path
        d="M48 152C32 138 22 120 22 100C22 56.9 56.9 22 100 22C128 22 153 37 167 60C155 42 132 30 106 30C67.3 30 36 61.3 36 100C36 121 46 139 61 151L48 152Z"
        fill="#071026"
      />

      {/* Inner White Cutout Background for Book */}
      <circle cx="100" cy="100" r="54" fill="white" />

      {/* Left Blue Page / Polygonal Emblem */}
      <path
        d="M68 78L94 90V136L68 124V78Z"
        fill="#0077E6"
      />

      {/* Right Red Page / Polygonal Emblem */}
      <path
        d="M106 90L132 78V124L106 136V90Z"
        fill="#E52320"
      />
    </svg>
  );

  if (!withText) {
    return svgIcon;
  }

  return (
    <div className="flex items-center gap-3">
      {svgIcon}
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span
            className="text-lg sm:text-xl font-black tracking-tight uppercase"
            style={{ color: textColor, fontFamily: 'sans-serif', letterSpacing: '0.05em' }}
          >
            PORTAL
          </span>
        </div>
        <span
          className="text-[9px] sm:text-[10px] font-bold tracking-widest uppercase text-[#C9A227]"
          style={{ letterSpacing: '0.18em' }}
        >
          CONCURSOS E OAB
        </span>
      </div>
    </div>
  );
};

/**
 * Foto 1: Full Horizontal Portal Concursos e OAB Banner & Logo
 */
export const PortalFullLogo: React.FC<{ className?: string; height?: number }> = ({
  className = '',
  height = 48,
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <PortalLogo size={height} />
      <div className="flex flex-col leading-none">
        <span className="text-xl sm:text-2xl font-black tracking-wider text-[#EDE6D6] font-sans">
          PORTAL
        </span>
        <span className="text-[10px] sm:text-[11px] font-extrabold tracking-widest text-[#C9A227] mt-0.5">
          CONCURSOS E OAB
        </span>
      </div>
    </div>
  );
};

/**
 * Foto 1 como Interface Meia Transparente (Semi-transparent Watermark Background)
 * Renders the official Portal Concursos e OAB logo watermark subtly behind the app interface
 */
export const PortalWatermarkBackground: React.FC<{ opacity?: number }> = ({ opacity = 0.045 }) => {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center select-none"
      aria-hidden="true"
    >
      {/* Diagonal Subtle Textured Watermark */}
      <div
        className="absolute w-[800px] h-[800px] sm:w-[1100px] sm:h-[1100px] lg:w-[1400px] lg:h-[1400px] opacity-[0.035] transition-opacity duration-1000 -rotate-12 translate-x-1/4 translate-y-[-10%]"
      >
        <svg
          viewBox="0 0 500 500"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Giant Background Embossed Portal Ring */}
          <circle cx="250" cy="250" r="230" stroke="#EDE6D6" strokeWidth="36" />
          <circle cx="250" cy="250" r="140" stroke="#EDE6D6" strokeWidth="12" strokeDasharray="16 16" />

          {/* Left Book Page */}
          <path d="M170 190L235 220V335L170 305V190Z" fill="#3B82F6" opacity="0.8" />

          {/* Right Book Page */}
          <path d="M265 220L330 190V305L265 335V220Z" fill="#EF4444" opacity="0.8" />
        </svg>
      </div>

      {/* Centered Large "PORTAL CONCURSOS E OAB" typography watermark from Foto 1 */}
      <div
        className="absolute bottom-10 left-10 lg:bottom-16 lg:left-16 flex items-center gap-6 opacity-[0.03] -rotate-6 pointer-events-none"
      >
        <div className="w-28 h-28 border-[10px] border-[#EDE6D6] rounded-full flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#C9A227] rounded-sm rotate-45" />
        </div>
        <div className="flex flex-col">
          <span className="text-6xl lg:text-8xl font-black tracking-widest text-[#EDE6D6] uppercase font-sans">
            PORTAL
          </span>
          <span className="text-xl lg:text-3xl font-bold tracking-[0.3em] text-[#C9A227] uppercase">
            CONCURSOS E OAB
          </span>
        </div>
      </div>
    </div>
  );
};
