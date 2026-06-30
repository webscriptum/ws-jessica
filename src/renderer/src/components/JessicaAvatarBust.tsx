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

const OL = '#1A0810' // outline color

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
          <stop offset="0%" stopColor="#F5CAA0" />
          <stop offset="100%" stopColor="#D4926A" />
        </linearGradient>
        <linearGradient id="jb-hair-grad" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="#280A1C" />
          <stop offset="100%" stopColor="#120608" />
        </linearGradient>
        <linearGradient id="jb-armor-grad" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#E8EDF4" />
          <stop offset="100%" stopColor="#B8C2CC" />
        </linearGradient>
        <linearGradient id="jb-lip-grad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#B8435A" />
          <stop offset="100%" stopColor="#D05A6E" />
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

      {/* ── HEAD GROUP ── */}
      <g className="jb-head">

        {/* ── HAIR (behind face) ── */}
        <g className="jb-hair">
          {/* Top dome */}
          <ellipse cx="100" cy="42" rx="56" ry="36"
            fill="url(#jb-hair-grad)" stroke={OL} strokeWidth="1.5" />
          {/* Left bob */}
          <rect x="44" y="54" width="24" height="108" rx="12"
            fill="url(#jb-hair-grad)" stroke={OL} strokeWidth="1.5" />
          {/* Right bob */}
          <rect x="132" y="54" width="24" height="108" rx="12"
            fill="url(#jb-hair-grad)" stroke={OL} strokeWidth="1.5" />
          {/* Fringe/bangs */}
          <path d="M 50 32 Q 100 16 150 32 L 150 60 Q 100 68 50 60 Z"
            fill="url(#jb-hair-grad)" stroke={OL} strokeWidth="1.5" />
          {/* Hair shine — single clean ellipse */}
          <ellipse cx="86" cy="33" rx="22" ry="7" fill="rgba(200,140,170,0.40)" />
          {/* Highlight streak left bob */}
          <ellipse cx="57" cy="58" rx="7" ry="24" fill="rgba(150,50,100,0.22)" />
        </g>

        {/* ── FACE ── */}
        <ellipse cx="100" cy="104" rx="52" ry="64"
          fill="url(#jb-skin-grad)" stroke={OL} strokeWidth="1.8" />
        {/* Forehead highlight */}
        <ellipse cx="96" cy="74" rx="20" ry="10" fill="rgba(255,240,220,0.45)" />
        {/* Cheek blush */}
        <ellipse cx="65" cy="120" rx="18" ry="10" fill="rgba(220,95,70,0.14)" />
        <ellipse cx="135" cy="120" rx="18" ry="10" fill="rgba(220,95,70,0.14)" />

        {/* ── EYEBROWS ── */}
        <path d="M 58 70 Q 72 61 91 65"
          stroke={OL} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M 109 65 Q 128 61 142 70"
          stroke={OL} strokeWidth="3.5" fill="none" strokeLinecap="round" />

        {/* ── LEFT EYE ── */}
        <g className="jb-eye-left">
          {/* Sclera */}
          <ellipse cx="74" cy="88" rx="17.5" ry="13"
            fill="#F8F7F2" stroke={OL} strokeWidth="1.5" />
          {/* Iris */}
          <circle cx="74" cy="89" r="11"
            fill="#1C0A08" stroke={OL} strokeWidth="1" />
          {/* Iris inner color */}
          <circle cx="74" cy="89" r="8" fill="#2A1210" />
          {/* Pupil */}
          <circle cx="74" cy="89" r="5.5" fill="#050102" />
          {/* Teal AI shimmer */}
          <circle cx="74" cy="89" r="3.5" fill="rgba(68,184,173,0.30)" />
          {/* Main catchlight */}
          <circle cx="67" cy="83" r="3.5" fill="rgba(255,255,255,0.96)" />
          {/* Secondary catchlight */}
          <circle cx="79" cy="93" r="1.5" fill="rgba(255,255,255,0.50)" />
          {/* Upper lid shadow */}
          <ellipse cx="74" cy="79.5" rx="17" ry="5" fill="rgba(8,3,14,0.25)" />
        </g>

        {/* ── RIGHT EYE ── */}
        <g className="jb-eye-right">
          <ellipse cx="126" cy="88" rx="17.5" ry="13"
            fill="#F8F7F2" stroke={OL} strokeWidth="1.5" />
          <circle cx="126" cy="89" r="11"
            fill="#1C0A08" stroke={OL} strokeWidth="1" />
          <circle cx="126" cy="89" r="8" fill="#2A1210" />
          <circle cx="126" cy="89" r="5.5" fill="#050102" />
          <circle cx="126" cy="89" r="3.5" fill="rgba(68,184,173,0.30)" />
          <circle cx="119" cy="83" r="3.5" fill="rgba(255,255,255,0.96)" />
          <circle cx="131" cy="93" r="1.5" fill="rgba(255,255,255,0.50)" />
          <ellipse cx="126" cy="79.5" rx="17" ry="5" fill="rgba(8,3,14,0.25)" />
        </g>

        {/* ── EYELASHES — clean arched path ── */}
        <path
          className="jb-lash-left"
          d="M 57 83 C 66 70 84 70 91 82"
          stroke={OL} strokeWidth="3" strokeLinecap="round" fill="none"
        />
        <path
          className="jb-lash-right"
          d="M 109 82 C 116 70 134 70 143 83"
          stroke={OL} strokeWidth="3" strokeLinecap="round" fill="none"
        />

        {/* ── NOSE — minimal nostrils ── */}
        <ellipse cx="95" cy="116" rx="2.5" ry="1.8" fill="rgba(155,80,40,0.40)" />
        <ellipse cx="105" cy="116" rx="2.5" ry="1.8" fill="rgba(155,80,40,0.40)" />

        {/* ── LIPS ── */}
        {/* Upper lip */}
        <path d="M 82 135 Q 90 126 100 129 Q 110 126 118 135 Q 109 139 100 138 Q 91 139 82 135 Z"
          fill="url(#jb-lip-grad)" stroke={OL} strokeWidth="1" />
        {/* Lower lip */}
        <path d="M 82 135 Q 91 150 100 152 Q 109 150 118 135 Q 109 139 100 138 Q 91 139 82 135 Z"
          fill="#D05A6E" stroke={OL} strokeWidth="1" />
        {/* Lip highlight */}
        <ellipse cx="100" cy="143" rx="11" ry="3.5" fill="rgba(255,210,200,0.30)" />

        {/* Subtle forehead tech line */}
        <line x1="88" y1="39" x2="112" y2="39"
          stroke="rgba(68,184,173,0.12)" strokeWidth="1" strokeLinecap="round" />
      </g>
      {/* ── END HEAD GROUP ── */}

      {/* ── NECK ── */}
      <path d="M 86 166 L 82 200 L 118 200 L 114 166 Z"
        fill="url(#jb-skin-grad)" stroke={OL} strokeWidth="1.5"
        strokeLinejoin="round" />
      {/* Neck side shadows */}
      <path d="M 86 166 L 84 190 L 82 200 L 86 200 Z" fill="rgba(150,75,35,0.13)" />
      <path d="M 114 166 L 116 190 L 118 200 L 114 200 Z" fill="rgba(150,75,35,0.13)" />

      {/* ── TECH COLLAR ── */}
      <rect x="74" y="196" width="52" height="14" rx="7" fill="#0C1A18" />
      <rect x="74" y="196" width="52" height="14" rx="7"
        fill="none" stroke="rgba(68,184,173,0.80)" strokeWidth="1.5" />
      <line x1="74" y1="203" x2="126" y2="203" stroke="rgba(68,184,173,0.18)" strokeWidth="6" />
      <circle className="jb-led" cx="87" cy="203" r="2.5" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led jb-led-2" cx="100" cy="203" r="3" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led" cx="113" cy="203" r="2.5" fill="#44B8AD" filter="url(#jb-led-glow)" />

      {/* ── ROBOT BODY / CHEST ── */}
      <path
        d="M 0 256 Q 26 218 68 212 L 82 202 L 100 214 L 118 202 L 132 212 Q 174 218 200 256 L 200 300 L 0 300 Z"
        fill="url(#jb-armor-grad)" stroke={OL} strokeWidth="1.2" strokeLinejoin="round"
      />
      {/* Shoulder highlights */}
      <path d="M 0 262 Q 20 224 60 218 L 68 215 L 68 217 Q 34 224 6 262 Z"
        fill="rgba(255,255,255,0.28)" />
      <path d="M 200 262 Q 180 224 140 218 L 132 215 L 132 217 Q 166 224 194 262 Z"
        fill="rgba(255,255,255,0.28)" />
      {/* Décolleté V */}
      <path d="M 82 202 L 100 222 L 118 202" fill="rgba(160,90,50,0.13)" />

      {/* Chest center plate */}
      <rect x="64" y="222" width="72" height="68" rx="10"
        fill="#D0D8E2" stroke={OL} strokeWidth="1" />
      <rect x="64" y="222" width="72" height="68" rx="10"
        fill="none" stroke="rgba(68,184,173,0.16)" strokeWidth="1.5" />

      {/* Circuit lines */}
      <line x1="76" y1="238" x2="124" y2="238" stroke="rgba(68,184,173,0.55)" strokeWidth="1.5" />
      <line x1="76" y1="250" x2="118" y2="250" stroke="rgba(68,184,173,0.35)" strokeWidth="1" />
      <line x1="76" y1="262" x2="120" y2="262" stroke="rgba(68,184,173,0.35)" strokeWidth="1" />
      <circle cx="124" cy="250" r="2" fill="rgba(68,184,173,0.44)" />
      <circle cx="120" cy="262" r="2" fill="rgba(68,184,173,0.44)" />

      {/* Status LEDs */}
      <circle className="jb-led jb-chest-led-1" cx="77" cy="280" r="5" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led jb-chest-led-2" cx="100" cy="280" r="5" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led jb-chest-led-3" cx="123" cy="280" r="5" fill="#44B8AD" filter="url(#jb-led-glow)" />

      {/* Plate edge highlight */}
      <rect x="64" y="222" width="72" height="68" rx="10"
        fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
    </svg>
  )
}
