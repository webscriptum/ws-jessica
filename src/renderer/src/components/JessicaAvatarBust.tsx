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
          <stop offset="0%" stopColor="#2E6B65" />
          <stop offset="100%" stopColor="#1A3E3C" />
        </linearGradient>
        <linearGradient id="jb-chest-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#243530" />
          <stop offset="100%" stopColor="#141E1D" />
        </linearGradient>
        <linearGradient id="jb-visor-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0A1A1A" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#061212" stopOpacity="0.9" />
        </linearGradient>
        <filter id="jb-eye-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="jb-led-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Antennae ── */}
      <g className="jb-antenna-left">
        <line x1="74" y1="38" x2="62" y2="10" stroke="#2E6B65" strokeWidth="3" strokeLinecap="round" />
        <circle cx="62" cy="8" r="5" fill="#44B8AD" className="jb-led" filter="url(#jb-led-glow)" />
      </g>
      <g className="jb-antenna-right">
        <line x1="126" y1="38" x2="138" y2="10" stroke="#2E6B65" strokeWidth="3" strokeLinecap="round" />
        <circle cx="138" cy="8" r="5" fill="#44B8AD" className="jb-led jb-led-2" filter="url(#jb-led-glow)" />
      </g>

      {/* ── Head ── */}
      <g className="jb-head">
        {/* Ear nubs */}
        <rect x="25" y="72" width="15" height="28" rx="7" fill="url(#jb-head-grad)" />
        <rect x="160" y="72" width="15" height="28" rx="7" fill="url(#jb-head-grad)" />

        {/* Main head shape */}
        <rect x="38" y="28" width="124" height="118" rx="34" fill="url(#jb-head-grad)" />

        {/* Visor band */}
        <rect x="38" y="56" width="124" height="42" fill="url(#jb-visor-grad)" />
        <rect x="38" y="56" width="124" height="1.5" fill="rgba(68,184,173,0.25)" />
        <rect x="38" y="97" width="124" height="1.5" fill="rgba(68,184,173,0.15)" />

        {/* Left eye */}
        <g className="jb-eye-left" filter="url(#jb-eye-glow)">
          <ellipse cx="80" cy="76" rx="14" ry="12" fill="rgba(255,255,255,0.92)" />
          <ellipse cx="80" cy="76" rx="6" ry="6" fill="#44B8AD" />
          <ellipse cx="77" cy="73" rx="2" ry="2" fill="rgba(255,255,255,0.6)" />
        </g>

        {/* Right eye */}
        <g className="jb-eye-right" filter="url(#jb-eye-glow)">
          <ellipse cx="120" cy="76" rx="14" ry="12" fill="rgba(255,255,255,0.92)" />
          <ellipse cx="120" cy="76" rx="6" ry="6" fill="#44B8AD" />
          <ellipse cx="117" cy="73" rx="2" ry="2" fill="rgba(255,255,255,0.6)" />
        </g>

        {/* Mouth LED bar */}
        <g className="jb-mouth">
          <rect className="jb-mouth-seg jb-ms-1" x="70"  y="115" width="9" height="7" rx="2.5" fill="#44B8AD" filter="url(#jb-led-glow)" />
          <rect className="jb-mouth-seg jb-ms-2" x="83"  y="115" width="9" height="7" rx="2.5" fill="#44B8AD" filter="url(#jb-led-glow)" />
          <rect className="jb-mouth-seg jb-ms-3" x="96"  y="115" width="9" height="7" rx="2.5" fill="#44B8AD" filter="url(#jb-led-glow)" />
          <rect className="jb-mouth-seg jb-ms-4" x="109" y="115" width="9" height="7" rx="2.5" fill="#44B8AD" filter="url(#jb-led-glow)" />
          <rect className="jb-mouth-seg jb-ms-5" x="122" y="115" width="9" height="7" rx="2.5" fill="#44B8AD" filter="url(#jb-led-glow)" />
        </g>

        {/* Forehead detail line */}
        <line x1="80" y1="38" x2="120" y2="38" stroke="rgba(68,184,173,0.2)" strokeWidth="1.5" strokeLinecap="round" />

        {/* Ear detail */}
        <circle cx="32" cy="86" r="3" fill="rgba(68,184,173,0.3)" />
        <circle cx="168" cy="86" r="3" fill="rgba(68,184,173,0.3)" />
      </g>

      {/* ── Neck ── */}
      <rect x="84" y="146" width="32" height="24" rx="8" fill="#1D3532" />
      <line x1="88" y1="154" x2="112" y2="154" stroke="rgba(68,184,173,0.35)" strokeWidth="1.5" />
      <line x1="88" y1="161" x2="112" y2="161" stroke="rgba(68,184,173,0.2)" strokeWidth="1.5" />

      {/* ── Chest ── */}
      <rect x="22" y="168" width="156" height="128" rx="22" fill="url(#jb-chest-grad)" />

      {/* Shoulder bolts */}
      <circle cx="43" cy="188" r="8" fill="#0F1D1C" />
      <circle cx="43" cy="188" r="4" fill="#1D3532" />
      <circle cx="157" cy="188" r="8" fill="#0F1D1C" />
      <circle cx="157" cy="188" r="4" fill="#1D3532" />

      {/* CPU panel */}
      <rect x="55" y="182" width="90" height="68" rx="10" fill="rgba(0,0,0,0.35)" />
      <rect x="55" y="182" width="90" height="68" rx="10" fill="none" stroke="rgba(68,184,173,0.15)" strokeWidth="1" />

      {/* Circuit lines */}
      <line x1="68" y1="198" x2="132" y2="198" stroke="rgba(68,184,173,0.5)" strokeWidth="1" />
      <line x1="68" y1="210" x2="118" y2="210" stroke="rgba(68,184,173,0.35)" strokeWidth="1" />
      <line x1="68" y1="222" x2="125" y2="222" stroke="rgba(68,184,173,0.35)" strokeWidth="1" />
      <circle cx="132" cy="210" r="2.5" fill="rgba(68,184,173,0.4)" />
      <circle cx="118" cy="222" r="2.5" fill="rgba(68,184,173,0.4)" />

      {/* Status LEDs */}
      <circle className="jb-led jb-chest-led-1" cx="76"  cy="238" r="5.5" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led jb-chest-led-2" cx="100" cy="238" r="5.5" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led jb-chest-led-3" cx="124" cy="238" r="5.5" fill="#44B8AD" filter="url(#jb-led-glow)" />

      {/* Chest border highlight */}
      <rect x="22" y="168" width="156" height="128" rx="22" fill="none" stroke="rgba(68,184,173,0.12)" strokeWidth="1.5" />
    </svg>
  )
}
