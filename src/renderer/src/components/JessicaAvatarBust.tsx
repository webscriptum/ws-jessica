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
        <linearGradient id="jb-skin-grad" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#F5CCAA" />
          <stop offset="100%" stopColor="#D48E58" />
        </linearGradient>
        <linearGradient id="jb-hair-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2E0E24" />
          <stop offset="55%" stopColor="#160810" />
          <stop offset="100%" stopColor="#0C0408" />
        </linearGradient>
        <linearGradient id="jb-armor-grad" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#E8EDF4" />
          <stop offset="100%" stopColor="#B8C2CC" />
        </linearGradient>
        <filter id="jb-led-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="jb-soft-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── HEAD GROUP (bobs + tilts with animation) ── */}
      <g className="jb-head">

        {/* ── HAIR (behind face, part of head group) ── */}
        <g className="jb-hair">
          {/* Top dome */}
          <ellipse cx="100" cy="40" rx="56" ry="34" fill="url(#jb-hair-grad)" />
          {/* Left side bob panel */}
          <rect x="44" y="50" width="24" height="110" rx="12" fill="url(#jb-hair-grad)" />
          {/* Right side bob panel */}
          <rect x="132" y="50" width="24" height="110" rx="12" fill="url(#jb-hair-grad)" />
          {/* Fringe/bangs */}
          <path d="M 50 30 Q 100 16 150 30 L 150 58 Q 100 65 50 58 Z" fill="url(#jb-hair-grad)" />
          {/* Purple-red highlight streaks */}
          <ellipse cx="58" cy="55" rx="9" ry="26" fill="rgba(140,35,90,0.28)" />
          <ellipse cx="142" cy="55" rx="7" ry="22" fill="rgba(140,35,90,0.20)" />
          {/* Hair shine */}
          <ellipse cx="84" cy="32" rx="20" ry="6" fill="rgba(255,200,220,0.08)" />
        </g>

        {/* ── FACE OVAL ── */}
        <ellipse cx="100" cy="104" rx="52" ry="65" fill="url(#jb-skin-grad)" />

        {/* Side shading */}
        <ellipse cx="54" cy="110" rx="15" ry="32" fill="rgba(160,75,35,0.09)" />
        <ellipse cx="146" cy="110" rx="15" ry="32" fill="rgba(160,75,35,0.09)" />

        {/* Cheek blush */}
        <ellipse cx="62" cy="118" rx="20" ry="11" fill="rgba(225,100,70,0.11)" />
        <ellipse cx="138" cy="118" rx="20" ry="11" fill="rgba(225,100,70,0.11)" />

        {/* ── EYEBROWS ── */}
        <path d="M 56 69 Q 72 61 91 65" stroke="#160A12" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M 109 65 Q 128 61 144 69" stroke="#160A12" strokeWidth="3.5" fill="none" strokeLinecap="round" />

        {/* ── LEFT EYE ── */}
        <g className="jb-eye-left">
          {/* Sclera */}
          <ellipse cx="74" cy="87" rx="18" ry="13" fill="#F8F8F6" />
          {/* Iris — dark */}
          <ellipse cx="74" cy="89" rx="12" ry="12.5" fill="#100608" />
          {/* Inner iris */}
          <ellipse cx="74" cy="89" rx="6.5" ry="7" fill="#080208" />
          {/* Teal AI shimmer in iris */}
          <ellipse cx="74" cy="89" rx="3.5" ry="4" fill="rgba(68,184,173,0.22)" />
          {/* Main catchlight */}
          <circle cx="67" cy="82" r="3.5" fill="rgba(255,255,255,0.94)" />
          {/* Secondary catchlight */}
          <circle cx="79" cy="92" r="1.5" fill="rgba(255,255,255,0.45)" />
          {/* Upper lid shadow */}
          <ellipse cx="74" cy="79" rx="17" ry="5.5" fill="rgba(8,4,14,0.28)" />
        </g>

        {/* ── RIGHT EYE ── */}
        <g className="jb-eye-right">
          <ellipse cx="126" cy="87" rx="18" ry="13" fill="#F8F8F6" />
          <ellipse cx="126" cy="89" rx="12" ry="12.5" fill="#100608" />
          <ellipse cx="126" cy="89" rx="6.5" ry="7" fill="#080208" />
          <ellipse cx="126" cy="89" rx="3.5" ry="4" fill="rgba(68,184,173,0.22)" />
          <circle cx="119" cy="82" r="3.5" fill="rgba(255,255,255,0.94)" />
          <circle cx="131" cy="92" r="1.5" fill="rgba(255,255,255,0.45)" />
          <ellipse cx="126" cy="79" rx="17" ry="5.5" fill="rgba(8,4,14,0.28)" />
        </g>

        {/* ── EYELASHES ── */}
        <path
          className="jb-lash-left"
          d="M 56 83 C 66 72 84 72 92 83"
          stroke="#0A0610"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          className="jb-lash-right"
          d="M 108 83 C 116 72 136 72 144 83"
          stroke="#0A0610"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />

        {/* ── NOSE (minimal, just nostrils) ── */}
        <path d="M 96 110 Q 98 118 100 120 Q 102 118 104 110" stroke="rgba(145,80,40,0.28)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <ellipse cx="94" cy="116" rx="2.2" ry="1.5" fill="rgba(145,80,40,0.35)" />
        <ellipse cx="106" cy="116" rx="2.2" ry="1.5" fill="rgba(145,80,40,0.35)" />

        {/* ── LIPS ── */}
        {/* Upper lip — cupid's bow */}
        <path d="M 82 135 Q 90 127 100 129 Q 110 127 118 135 Q 109 139 100 138 Q 91 139 82 135 Z" fill="#C05F6E" />
        {/* Lower lip */}
        <path d="M 82 135 Q 91 150 100 152 Q 109 150 118 135 Q 109 139 100 138 Q 91 139 82 135 Z" fill="#D0707E" />
        {/* Lip gloss */}
        <ellipse cx="100" cy="143" rx="12" ry="3.5" fill="rgba(255,210,200,0.22)" />
        {/* Philtrum / cupid dip line */}
        <path d="M 82 135 Q 91 128 100 129 Q 109 128 118 135" stroke="rgba(155,60,72,0.4)" strokeWidth="0.8" fill="none" />

        {/* Subtle tech line on forehead */}
        <line x1="88" y1="38" x2="112" y2="38" stroke="rgba(68,184,173,0.10)" strokeWidth="1" strokeLinecap="round" />
      </g>
      {/* ── END HEAD GROUP ── */}

      {/* ── NECK ── */}
      <path d="M 86 166 L 82 200 L 118 200 L 114 166 Z" fill="url(#jb-skin-grad)" />
      {/* Neck side shadows */}
      <path d="M 86 166 L 84 190 L 82 200 L 86 200 Z" fill="rgba(150,75,35,0.12)" />
      <path d="M 114 166 L 116 190 L 118 200 L 114 200 Z" fill="rgba(150,75,35,0.12)" />

      {/* ── TECH COLLAR ── */}
      <rect x="74" y="196" width="52" height="14" rx="7" fill="#0C1A18" />
      <rect x="74" y="196" width="52" height="14" rx="7" fill="none" stroke="rgba(68,184,173,0.78)" strokeWidth="1.5" />
      {/* Collar ambient glow */}
      <line x1="74" y1="203" x2="126" y2="203" stroke="rgba(68,184,173,0.18)" strokeWidth="6" />
      {/* Collar LEDs */}
      <circle className="jb-led" cx="87" cy="203" r="2.5" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led jb-led-2" cx="100" cy="203" r="3" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led" cx="113" cy="203" r="2.5" fill="#44B8AD" filter="url(#jb-led-glow)" />

      {/* ── ROBOT BODY / CHEST ── */}
      {/* Main body fill */}
      <path
        d="M 0 256 Q 26 218 68 212 L 82 202 L 100 214 L 118 202 L 132 212 Q 174 218 200 256 L 200 300 L 0 300 Z"
        fill="url(#jb-armor-grad)"
      />
      {/* Shoulder pad highlights */}
      <path d="M 0 262 Q 20 224 60 218 L 68 215 L 68 217 Q 34 224 6 262 Z" fill="rgba(255,255,255,0.28)" />
      <path d="M 200 262 Q 180 224 140 218 L 132 215 L 132 217 Q 166 224 194 262 Z" fill="rgba(255,255,255,0.28)" />
      {/* Décolleté V shadow */}
      <path d="M 82 202 L 100 222 L 118 202" fill="rgba(160,90,50,0.14)" />

      {/* Chest center armor plate */}
      <rect x="64" y="222" width="72" height="68" rx="10" fill="#D0D8E2" />
      <rect x="64" y="222" width="72" height="68" rx="10" fill="none" stroke="rgba(68,184,173,0.14)" strokeWidth="1.5" />

      {/* Circuit lines on chest */}
      <line x1="76" y1="238" x2="124" y2="238" stroke="rgba(68,184,173,0.55)" strokeWidth="1.5" />
      <line x1="76" y1="250" x2="118" y2="250" stroke="rgba(68,184,173,0.35)" strokeWidth="1" />
      <line x1="76" y1="262" x2="120" y2="262" stroke="rgba(68,184,173,0.35)" strokeWidth="1" />
      <circle cx="124" cy="250" r="2" fill="rgba(68,184,173,0.42)" />
      <circle cx="120" cy="262" r="2" fill="rgba(68,184,173,0.42)" />

      {/* Status LEDs */}
      <circle className="jb-led jb-chest-led-1" cx="77" cy="280" r="5" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led jb-chest-led-2" cx="100" cy="280" r="5" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led jb-chest-led-3" cx="123" cy="280" r="5" fill="#44B8AD" filter="url(#jb-led-glow)" />

      {/* Chest plate edge highlight */}
      <rect x="64" y="222" width="72" height="68" rx="10" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
    </svg>
  )
}
