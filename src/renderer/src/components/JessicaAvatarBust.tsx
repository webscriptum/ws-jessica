import type { MascotAvatarSize } from '../../../preload/index.d'

interface Props {
  size?: MascotAvatarSize
  state?: 'idle' | 'thinking'
}

const SIZES: Record<MascotAvatarSize, { w: number; h: number }> = {
  small:  { w: 160, h: 240 },
  medium: { w: 200, h: 300 },
  large:  { w: 240, h: 360 }
}

export default function JessicaAvatarBust({ size = 'medium', state = 'idle' }: Props): JSX.Element {
  const { w, h } = SIZES[size]
  const cls = `jessica-bust jessica-bust--${state}`

  return (
    <svg
      className={cls}
      width={w}
      height={h}
      viewBox="0 0 200 300"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="jb-head-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#326862" />
          <stop offset="100%" stopColor="#1C4040" />
        </linearGradient>
        <linearGradient id="jb-hair-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#245550" />
          <stop offset="100%" stopColor="#142E2C" />
        </linearGradient>
        <linearGradient id="jb-chest-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E3230" />
          <stop offset="100%" stopColor="#0E1C1B" />
        </linearGradient>
        <filter id="jb-eye-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="jb-led-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="jb-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── Hair panels (robot-style, left + right + dome) ── */}
      <g className="jb-hair">
        {/* Left hair panel */}
        <rect x="22" y="28" width="22" height="58" rx="11" fill="url(#jb-hair-grad)" />
        <rect x="25" y="32" width="8" height="22" rx="4" fill="rgba(68,184,173,0.15)" />
        <circle cx="33" cy="70" r="3" fill="rgba(68,184,173,0.4)" />

        {/* Right hair panel */}
        <rect x="156" y="28" width="22" height="58" rx="11" fill="url(#jb-hair-grad)" />
        <rect x="167" y="32" width="8" height="22" rx="4" fill="rgba(68,184,173,0.15)" />
        <circle cx="167" cy="70" r="3" fill="rgba(68,184,173,0.4)" />

        {/* Top dome */}
        <ellipse cx="100" cy="24" rx="48" ry="18" fill="url(#jb-hair-grad)" />
        <ellipse cx="100" cy="20" rx="34" ry="8" fill="rgba(68,184,173,0.12)" />
      </g>

      {/* ── Antennas ── */}
      <g className="jb-antenna-left">
        <line x1="76" y1="30" x2="64" y2="6" stroke="#245550" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="64" cy="5" r="4.5" fill="#44B8AD" className="jb-led" filter="url(#jb-led-glow)" />
      </g>
      <g className="jb-antenna-right">
        <line x1="124" y1="30" x2="136" y2="6" stroke="#245550" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="136" cy="5" r="4.5" fill="#44B8AD" className="jb-led jb-led-2" filter="url(#jb-led-glow)" />
      </g>

      {/* ── Head (oval, feminine) ── */}
      <g className="jb-head">
        {/* Main face shape */}
        <rect x="36" y="26" width="128" height="140" rx="48" fill="url(#jb-head-grad)" />

        {/* Subtle face highlight */}
        <ellipse cx="100" cy="70" rx="52" ry="40" fill="rgba(255,255,255,0.04)" />

        {/* ── Left eye ── */}
        <g className="jb-eye-left" filter="url(#jb-eye-glow)">
          {/* Sclera */}
          <ellipse cx="76" cy="91" rx="19" ry="17" fill="rgba(240,255,254,0.95)" />
          {/* Iris */}
          <ellipse cx="76" cy="93" rx="11" ry="13" fill="#3AADA3" />
          {/* Pupil */}
          <ellipse cx="76" cy="93" rx="6" ry="7" fill="#051010" />
          {/* Shine highlights */}
          <circle cx="70" cy="86" r="4" fill="rgba(255,255,255,0.92)" />
          <circle cx="82" cy="100" r="1.8" fill="rgba(255,255,255,0.5)" />
        </g>

        {/* ── Right eye ── */}
        <g className="jb-eye-right" filter="url(#jb-eye-glow)">
          <ellipse cx="124" cy="91" rx="19" ry="17" fill="rgba(240,255,254,0.95)" />
          <ellipse cx="124" cy="93" rx="11" ry="13" fill="#3AADA3" />
          <ellipse cx="124" cy="93" rx="6" ry="7" fill="#051010" />
          <circle cx="118" cy="86" r="4" fill="rgba(255,255,255,0.92)" />
          <circle cx="130" cy="100" r="1.8" fill="rgba(255,255,255,0.5)" />
        </g>

        {/* ── Eyelashes (arcs above eyes) ── */}
        <path
          className="jb-lash-left"
          d="M 55 79 C 68 68 88 68 99 79"
          stroke="#1A4A44"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          className="jb-lash-right"
          d="M 101 79 C 112 68 132 68 145 79"
          stroke="#1A4A44"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />

        {/* ── Cheek blush ── */}
        <ellipse cx="52" cy="110" rx="15" ry="9" fill="rgba(255,130,110,0.08)" />
        <ellipse cx="148" cy="110" rx="15" ry="9" fill="rgba(255,130,110,0.08)" />

        {/* ── Nose (minimal dot) ── */}
        <circle cx="100" cy="118" r="2.5" fill="rgba(68,184,173,0.22)" />

        {/* ── Mouth: curved smile + 3 LED dots ── */}
        <path
          d="M 80 134 Q 100 144 120 134"
          stroke="rgba(68,184,173,0.45)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <circle className="jb-mouth-seg jb-ms-1" cx="80"  cy="134" r="3.5" fill="#44B8AD" filter="url(#jb-led-glow)" />
        <circle className="jb-mouth-seg jb-ms-2" cx="100" cy="140" r="3.5" fill="#44B8AD" filter="url(#jb-led-glow)" />
        <circle className="jb-mouth-seg jb-ms-3" cx="120" cy="134" r="3.5" fill="#44B8AD" filter="url(#jb-led-glow)" />

        {/* ── Forehead tech line ── */}
        <line x1="82" y1="36" x2="118" y2="36" stroke="rgba(68,184,173,0.18)" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* ── Neck ── */}
      <rect x="84" y="166" width="32" height="22" rx="8" fill="#183030" />
      <line x1="88" y1="174" x2="112" y2="174" stroke="rgba(68,184,173,0.3)" strokeWidth="1.5" />
      <line x1="88" y1="181" x2="112" y2="181" stroke="rgba(68,184,173,0.2)" strokeWidth="1.5" />

      {/* ── Chest ── */}
      <rect x="20" y="186" width="160" height="112" rx="22" fill="url(#jb-chest-grad)" />

      {/* Shoulder detail */}
      <circle cx="40" cy="206" r="8" fill="#0A1818" />
      <circle cx="40" cy="206" r="4" fill="#162828" />
      <circle cx="160" cy="206" r="8" fill="#0A1818" />
      <circle cx="160" cy="206" r="4" fill="#162828" />

      {/* CPU panel */}
      <rect x="54" y="200" width="92" height="62" rx="10" fill="rgba(0,0,0,0.3)" />
      <rect x="54" y="200" width="92" height="62" rx="10" fill="none" stroke="rgba(68,184,173,0.12)" strokeWidth="1" />

      {/* Circuit lines */}
      <line x1="67" y1="216" x2="133" y2="216" stroke="rgba(68,184,173,0.45)" strokeWidth="1" />
      <line x1="67" y1="228" x2="122" y2="228" stroke="rgba(68,184,173,0.3)" strokeWidth="1" />
      <line x1="67" y1="240" x2="128" y2="240" stroke="rgba(68,184,173,0.3)" strokeWidth="1" />
      <circle cx="133" cy="228" r="2" fill="rgba(68,184,173,0.35)" />
      <circle cx="122" cy="240" r="2" fill="rgba(68,184,173,0.35)" />

      {/* Status LEDs */}
      <circle className="jb-led jb-chest-led-1" cx="74"  cy="254" r="5" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led jb-chest-led-2" cx="100" cy="254" r="5" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led jb-chest-led-3" cx="126" cy="254" r="5" fill="#44B8AD" filter="url(#jb-led-glow)" />

      {/* Chest border */}
      <rect x="20" y="186" width="160" height="112" rx="22" fill="none" stroke="rgba(68,184,173,0.1)" strokeWidth="1.5" />
    </svg>
  )
}
