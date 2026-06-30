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

const OL = '#1A0810'

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
        {/* Skin — porcelain */}
        <linearGradient id="jb-skin" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#F5E8D4" />
          <stop offset="100%" stopColor="#DDC4A0" />
        </linearGradient>
        {/* Hair — platinum blonde top-to-bottom */}
        <linearGradient id="jb-hair-v" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#C4BAA2" />
          <stop offset="45%" stopColor="#E4DCC6" />
          <stop offset="100%" stopColor="#EEEAD8" />
        </linearGradient>
        {/* Armor body */}
        <linearGradient id="jb-armor" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="#D4DCE6" />
          <stop offset="100%" stopColor="#A4B0BC" />
        </linearGradient>
        {/* Chest plate */}
        <linearGradient id="jb-plate" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C4CED8" />
          <stop offset="40%" stopColor="#DCE6F0" />
          <stop offset="100%" stopColor="#AEB8C2" />
        </linearGradient>
        {/* Lips */}
        <linearGradient id="jb-lip" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#BE7480" />
          <stop offset="100%" stopColor="#9E5464" />
        </linearGradient>
        {/* Power core */}
        <radialGradient id="jb-core" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#A8F0EA" />
          <stop offset="55%" stopColor="#44B8AD" />
          <stop offset="100%" stopColor="#1A6060" />
        </radialGradient>
        {/* Filters */}
        <filter id="jb-glow-sm" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="jb-glow-lg" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ══════════════════════════════════════
          HEAD GROUP
      ══════════════════════════════════════ */}
      <g className="jb-head">

        {/* ── LAYER 1: BOB SILHOUETTE (behind face) ── */}
        <g className="jb-hair">
          {/* Full bob: straight vertical sides + rounded dome */}
          <path
            d="M 44 162 L 44 58 Q 46 18 100 16 Q 154 18 156 58 L 156 162 Z"
            fill="url(#jb-hair-v)" stroke={OL} strokeWidth="1.6" strokeLinejoin="round"
          />
          {/* Dome highlight */}
          <ellipse cx="88" cy="30" rx="22" ry="8" fill="rgba(255,252,240,0.55)" />
          <ellipse cx="112" cy="34" rx="11" ry="4" fill="rgba(255,252,240,0.35)" />
          {/* Strand lines — left panel */}
          <line x1="58" y1="64" x2="52" y2="155" stroke="rgba(166,154,128,0.20)" strokeWidth="1" strokeLinecap="round" />
          <line x1="62" y1="64" x2="57" y2="155" stroke="rgba(166,154,128,0.15)" strokeWidth="0.8" strokeLinecap="round" />
          {/* Strand lines — right panel */}
          <line x1="142" y1="64" x2="148" y2="155" stroke="rgba(166,154,128,0.20)" strokeWidth="1" strokeLinecap="round" />
          <line x1="138" y1="64" x2="143" y2="155" stroke="rgba(166,154,128,0.15)" strokeWidth="0.8" strokeLinecap="round" />
        </g>

        {/* ── LAYER 2: FACE ── */}
        <ellipse cx="100" cy="100" rx="46" ry="62"
          fill="url(#jb-skin)" stroke={OL} strokeWidth="1.8" />
        {/* Forehead highlight */}
        <ellipse cx="96" cy="72" rx="18" ry="9" fill="rgba(255,248,236,0.38)" />
        {/* Cheek blush */}
        <ellipse cx="68" cy="116" rx="15" ry="9" fill="rgba(195,110,90,0.10)" />
        <ellipse cx="132" cy="116" rx="15" ry="9" fill="rgba(195,110,90,0.10)" />

        {/* ── LAYER 3: FRINGE (over face, creates straight-cut look) ── */}
        <path
          d="M 48 16 Q 100 8 152 16 L 152 64 Q 100 72 48 64 Z"
          fill="url(#jb-hair-v)" stroke={OL} strokeWidth="1.6" strokeLinejoin="round"
        />
        {/* Fringe shine */}
        <ellipse cx="98" cy="50" rx="28" ry="5" fill="rgba(255,252,240,0.48)" />
        {/* Fringe strand lines */}
        <line x1="80" y1="40" x2="78" y2="64" stroke="rgba(166,154,128,0.18)" strokeWidth="0.8" strokeLinecap="round" />
        <line x1="94" y1="36" x2="92" y2="64" stroke="rgba(166,154,128,0.14)" strokeWidth="0.8" strokeLinecap="round" />
        <line x1="108" y1="36" x2="110" y2="64" stroke="rgba(166,154,128,0.14)" strokeWidth="0.8" strokeLinecap="round" />
        <line x1="120" y1="40" x2="122" y2="64" stroke="rgba(166,154,128,0.18)" strokeWidth="0.8" strokeLinecap="round" />

        {/* ── EYEBROWS ── */}
        <path d="M 63 75 Q 75 68 88 72"
          stroke="#3A2018" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 112 72 Q 125 68 137 75"
          stroke="#3A2018" strokeWidth="2" fill="none" strokeLinecap="round" />

        {/* ── LEFT EYE — blue, realistically sized (rx=11 ry=8) ── */}
        <g className="jb-eye-left">
          <ellipse cx="74" cy="88" rx="11" ry="8"
            fill="#F8F7F2" stroke={OL} strokeWidth="1.4" />
          <circle cx="74" cy="88.5" r="7.2" fill="#2A5A8A" />
          <circle cx="74" cy="88.5" r="5.8" fill="#4890C8" />
          <circle cx="74" cy="88.5" r="3.5" fill="#060208" />
          <circle cx="74" cy="88.5" r="2.0" fill="rgba(68,184,173,0.30)" />
          <circle cx="69.5" cy="84.5" r="2.2" fill="rgba(255,255,255,0.96)" />
          <circle cx="77" cy="91.5" r="1.1" fill="rgba(255,255,255,0.52)" />
          <ellipse cx="74" cy="81.5" rx="10.5" ry="4" fill="rgba(6,2,12,0.20)" />
        </g>

        {/* ── RIGHT EYE — blue, realistically sized ── */}
        <g className="jb-eye-right">
          <ellipse cx="126" cy="88" rx="11" ry="8"
            fill="#F8F7F2" stroke={OL} strokeWidth="1.4" />
          <circle cx="126" cy="88.5" r="7.2" fill="#2A5A8A" />
          <circle cx="126" cy="88.5" r="5.8" fill="#4890C8" />
          <circle cx="126" cy="88.5" r="3.5" fill="#060208" />
          <circle cx="126" cy="88.5" r="2.0" fill="rgba(68,184,173,0.30)" />
          <circle cx="121.5" cy="84.5" r="2.2" fill="rgba(255,255,255,0.96)" />
          <circle cx="129" cy="91.5" r="1.1" fill="rgba(255,255,255,0.52)" />
          <ellipse cx="126" cy="81.5" rx="10.5" ry="4" fill="rgba(6,2,12,0.20)" />
        </g>

        {/* ── EYELASHES — scaled to new eye size ── */}
        <path className="jb-lash-left"
          d="M 63 83 C 70 73 80 73 85 82"
          stroke={OL} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path className="jb-lash-right"
          d="M 115 82 C 120 73 130 73 137 83"
          stroke={OL} strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* ── NOSE — minimal ── */}
        <ellipse cx="95.5" cy="112" rx="2.2" ry="1.6" fill="rgba(160,100,70,0.30)" />
        <ellipse cx="104.5" cy="112" rx="2.2" ry="1.6" fill="rgba(160,100,70,0.30)" />

        {/* ── LIPS ── */}
        <path d="M 86 130 Q 92 122 100 126 Q 108 122 114 130 Q 107 134 100 133 Q 93 134 86 130 Z"
          fill="url(#jb-lip)" stroke={OL} strokeWidth="1" />
        <path d="M 86 130 Q 93 146 100 148 Q 107 146 114 130 Q 107 134 100 133 Q 93 134 86 130 Z"
          fill="#9E5464" stroke={OL} strokeWidth="1" />
        <ellipse cx="100" cy="139" rx="8.5" ry="2.5" fill="rgba(255,210,200,0.22)" />

        {/* ── ROBOT HEAD ELEMENTS ── */}
        {/* Temple circuit — right side */}
        <path d="M 141 82 L 147 92 L 145 106"
          stroke="rgba(68,184,173,0.65)" strokeWidth="1.2"
          fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="141" cy="82" r="1.4" fill="rgba(68,184,173,0.60)" />
        {/* Temple LED */}
        <circle className="jb-led" cx="145" cy="106" r="2.0"
          fill="#44B8AD" filter="url(#jb-glow-sm)" />
        {/* Right earpiece */}
        <circle cx="150" cy="114" r="6.5"
          fill="#0E1E1C" stroke="rgba(68,184,173,0.78)" strokeWidth="1.4" />
        <circle cx="150" cy="114" r="3.5"
          fill="#142220" stroke="rgba(68,184,173,0.36)" strokeWidth="0.8" />
        <circle className="jb-led" cx="150" cy="114" r="1.8"
          fill="#44B8AD" filter="url(#jb-glow-sm)" />
        <line x1="150" y1="107.5" x2="150" y2="103"
          stroke="rgba(68,184,173,0.42)" strokeWidth="1.4" strokeLinecap="round" />
      </g>
      {/* ══ END HEAD ══ */}

      {/* ── NECK ── */}
      <path d="M 88 162 L 84 200 L 116 200 L 112 162 Z"
        fill="url(#jb-skin)" stroke={OL} strokeWidth="1.4" strokeLinejoin="round" />

      {/* ── TECH COLLAR ── */}
      <rect x="76" y="197" width="48" height="13" rx="6.5"
        fill="#0C1A18" stroke="rgba(68,184,173,0.76)" strokeWidth="1.4" />
      <line x1="76" y1="203.5" x2="124" y2="203.5" stroke="rgba(68,184,173,0.16)" strokeWidth="5" />
      <circle className="jb-led" cx="89" cy="203.5" r="2.3" fill="#44B8AD" filter="url(#jb-glow-sm)" />
      <circle className="jb-led jb-led-2" cx="100" cy="203.5" r="2.8" fill="#44B8AD" filter="url(#jb-glow-sm)" />
      <circle className="jb-led" cx="111" cy="203.5" r="2.3" fill="#44B8AD" filter="url(#jb-glow-sm)" />

      {/* ── ROBOT BODY ── */}
      <path
        d="M 0 256 Q 26 218 68 212 L 84 202 L 100 215 L 116 202 L 132 212 Q 174 218 200 256 L 200 300 L 0 300 Z"
        fill="url(#jb-armor)" stroke={OL} strokeWidth="1.2" strokeLinejoin="round"
      />
      {/* Shoulder highlights */}
      <path d="M 2 262 Q 22 226 62 220 L 68 216 Q 32 226 6 262 Z" fill="rgba(255,255,255,0.22)" />
      <path d="M 198 262 Q 178 226 138 220 L 132 216 Q 168 226 194 262 Z" fill="rgba(255,255,255,0.22)" />
      {/* Shoulder joints */}
      <circle cx="70" cy="218" r="5"
        fill="#0E1A22" stroke="rgba(68,184,173,0.62)" strokeWidth="1.5" />
      <circle cx="70" cy="218" r="2.2" fill="rgba(68,184,173,0.38)" />
      <circle cx="130" cy="218" r="5"
        fill="#0E1A22" stroke="rgba(68,184,173,0.62)" strokeWidth="1.5" />
      <circle cx="130" cy="218" r="2.2" fill="rgba(68,184,173,0.38)" />
      {/* Shoulder arcs */}
      <path d="M 65 213 Q 60 222 64 230"
        stroke="rgba(68,184,173,0.40)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M 135 213 Q 140 222 136 230"
        stroke="rgba(68,184,173,0.40)" strokeWidth="1.4" fill="none" strokeLinecap="round" />

      {/* Chest plate */}
      <rect x="66" y="223" width="68" height="66" rx="9"
        fill="url(#jb-plate)" stroke={OL} strokeWidth="1" />
      {/* Panel dividers */}
      <line x1="89" y1="226" x2="89" y2="287" stroke="rgba(68,184,173,0.20)" strokeWidth="1" />
      <line x1="111" y1="226" x2="111" y2="287" stroke="rgba(68,184,173,0.20)" strokeWidth="1" />
      <line x1="68" y1="246" x2="132" y2="246" stroke="rgba(68,184,173,0.26)" strokeWidth="1" />
      {/* Circuit traces */}
      <line x1="70" y1="236" x2="87" y2="236" stroke="rgba(68,184,173,0.50)" strokeWidth="1.3" />
      <line x1="113" y1="236" x2="130" y2="236" stroke="rgba(68,184,173,0.50)" strokeWidth="1.3" />
      <circle cx="87" cy="236" r="1.4" fill="rgba(68,184,173,0.50)" />
      <circle cx="113" cy="236" r="1.4" fill="rgba(68,184,173,0.50)" />
      <rect x="66" y="223" width="68" height="66" rx="9"
        fill="none" stroke="rgba(68,184,173,0.16)" strokeWidth="1.4" />

      {/* Power core */}
      <circle cx="100" cy="260" r="12"
        fill="url(#jb-core)" filter="url(#jb-glow-lg)" />
      <circle cx="100" cy="260" r="12"
        fill="none" stroke="rgba(68,184,173,0.82)" strokeWidth="1.4" />
      <polygon
        points="100,251 107.8,255.5 107.8,264.5 100,269 92.2,264.5 92.2,255.5"
        fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="1" />
      <circle cx="100" cy="260" r="4" fill="rgba(200,255,250,0.70)" />

      {/* Status LEDs */}
      <line x1="74" y1="276" x2="74" y2="270" stroke="rgba(68,184,173,0.36)" strokeWidth="1" />
      <circle className="jb-led jb-chest-led-1" cx="74" cy="280" r="4.2"
        fill="#44B8AD" filter="url(#jb-glow-sm)" />
      <line x1="126" y1="276" x2="126" y2="270" stroke="rgba(68,184,173,0.36)" strokeWidth="1" />
      <circle className="jb-led jb-chest-led-3" cx="126" cy="280" r="4.2"
        fill="#44B8AD" filter="url(#jb-glow-sm)" />
    </svg>
  )
}
