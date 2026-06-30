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
        {/* Skin — porcelain/fair */}
        <linearGradient id="jb-skin-grad" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#F6E8D6" />
          <stop offset="100%" stopColor="#DEC4A4" />
        </linearGradient>
        {/* Hair — platinum blonde bob */}
        <linearGradient id="jb-hair-grad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#C8C0A8" />
          <stop offset="45%" stopColor="#E6DEC8" />
          <stop offset="100%" stopColor="#EEE8D8" />
        </linearGradient>
        {/* Armor body */}
        <linearGradient id="jb-armor-grad" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#D8E0EA" />
          <stop offset="100%" stopColor="#A8B4C0" />
        </linearGradient>
        {/* Chest plate — metallic with highlight stripe */}
        <linearGradient id="jb-armor-plate" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C8D2DC" />
          <stop offset="42%" stopColor="#DDE5EE" />
          <stop offset="100%" stopColor="#B0BBC6" />
        </linearGradient>
        {/* Lips — natural rose */}
        <linearGradient id="jb-lip-grad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#C07880" />
          <stop offset="100%" stopColor="#A05868" />
        </linearGradient>
        {/* Power core — teal radial glow */}
        <radialGradient id="jb-core-grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#A8F0EA" />
          <stop offset="55%" stopColor="#44B8AD" />
          <stop offset="100%" stopColor="#1A6060" />
        </radialGradient>
        {/* Filters */}
        <filter id="jb-led-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="jb-core-glow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="jb-soft-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── HEAD GROUP ── */}
      <g className="jb-head">

        {/* ── HAIR — platinum blonde bob with straight fringe ── */}
        <g className="jb-hair">
          {/* Top dome */}
          <ellipse cx="100" cy="42" rx="56" ry="36"
            fill="url(#jb-hair-grad)" stroke={OL} strokeWidth="1.5" />
          {/* Left bob panel */}
          <rect x="44" y="54" width="24" height="108" rx="12"
            fill="url(#jb-hair-grad)" stroke={OL} strokeWidth="1.5" />
          {/* Right bob panel */}
          <rect x="132" y="54" width="24" height="108" rx="12"
            fill="url(#jb-hair-grad)" stroke={OL} strokeWidth="1.5" />
          {/* Fringe — straight cut */}
          <path d="M 50 32 Q 100 16 150 32 L 150 60 Q 100 68 50 60 Z"
            fill="url(#jb-hair-grad)" stroke={OL} strokeWidth="1.5" />
          {/* Primary shine — bright highlight on top dome */}
          <ellipse cx="88" cy="31" rx="26" ry="7" fill="rgba(255,252,238,0.68)" />
          {/* Secondary shine */}
          <ellipse cx="112" cy="35" rx="13" ry="4" fill="rgba(255,252,238,0.42)" />
          {/* Fringe shine */}
          <ellipse cx="100" cy="52" rx="30" ry="4" fill="rgba(255,252,238,0.30)" />
          {/* Strand lines — silky straight hair texture */}
          <line x1="66" y1="60" x2="58" y2="150" stroke="rgba(175,162,138,0.32)" strokeWidth="0.9" strokeLinecap="round" />
          <line x1="72" y1="65" x2="65" y2="155" stroke="rgba(175,162,138,0.22)" strokeWidth="0.8" strokeLinecap="round" />
          <line x1="135" y1="60" x2="143" y2="150" stroke="rgba(175,162,138,0.32)" strokeWidth="0.9" strokeLinecap="round" />
          <line x1="82" y1="40" x2="80" y2="60" stroke="rgba(175,162,138,0.28)" strokeWidth="0.8" strokeLinecap="round" />
          <line x1="94" y1="37" x2="92" y2="62" stroke="rgba(175,162,138,0.22)" strokeWidth="0.8" strokeLinecap="round" />
          <line x1="108" y1="37" x2="110" y2="62" stroke="rgba(175,162,138,0.22)" strokeWidth="0.8" strokeLinecap="round" />
          <line x1="120" y1="40" x2="122" y2="60" stroke="rgba(175,162,138,0.28)" strokeWidth="0.8" strokeLinecap="round" />
        </g>

        {/* ── FACE — porcelain ── */}
        <ellipse cx="100" cy="104" rx="52" ry="64"
          fill="url(#jb-skin-grad)" stroke={OL} strokeWidth="1.8" />
        {/* Forehead highlight */}
        <ellipse cx="96" cy="74" rx="20" ry="10" fill="rgba(255,248,238,0.40)" />
        {/* Subtle cheek blush */}
        <ellipse cx="66" cy="120" rx="17" ry="10" fill="rgba(200,120,100,0.11)" />
        <ellipse cx="134" cy="120" rx="17" ry="10" fill="rgba(200,120,100,0.11)" />

        {/* ── EYEBROWS — natural brown, not too heavy ── */}
        <path d="M 60 71 Q 73 62 91 65"
          stroke="#3A2018" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 109 65 Q 127 62 140 71"
          stroke="#3A2018" strokeWidth="3" fill="none" strokeLinecap="round" />

        {/* ── LEFT EYE — blue ── */}
        <g className="jb-eye-left">
          <ellipse cx="74" cy="88" rx="17.5" ry="13"
            fill="#F8F7F2" stroke={OL} strokeWidth="1.5" />
          {/* Iris — layered blue */}
          <circle cx="74" cy="89" r="11" fill="#2A5A8A" stroke={OL} strokeWidth="1" />
          <circle cx="74" cy="89" r="9.2" fill="#4A8EC2" />
          <circle cx="74" cy="89" r="6.5" fill="#3A78B0" />
          {/* Pupil */}
          <circle cx="74" cy="89" r="4.5" fill="#060208" />
          {/* Teal AI shimmer */}
          <circle cx="74" cy="89" r="2.8" fill="rgba(68,184,173,0.38)" />
          {/* Catchlights */}
          <circle cx="67" cy="83" r="3.2" fill="rgba(255,255,255,0.96)" />
          <circle cx="79" cy="93" r="1.4" fill="rgba(255,255,255,0.52)" />
          {/* Lid shadow */}
          <ellipse cx="74" cy="79.5" rx="17" ry="5" fill="rgba(6,2,12,0.22)" />
        </g>

        {/* ── RIGHT EYE — blue ── */}
        <g className="jb-eye-right">
          <ellipse cx="126" cy="88" rx="17.5" ry="13"
            fill="#F8F7F2" stroke={OL} strokeWidth="1.5" />
          <circle cx="126" cy="89" r="11" fill="#2A5A8A" stroke={OL} strokeWidth="1" />
          <circle cx="126" cy="89" r="9.2" fill="#4A8EC2" />
          <circle cx="126" cy="89" r="6.5" fill="#3A78B0" />
          <circle cx="126" cy="89" r="4.5" fill="#060208" />
          <circle cx="126" cy="89" r="2.8" fill="rgba(68,184,173,0.38)" />
          <circle cx="119" cy="83" r="3.2" fill="rgba(255,255,255,0.96)" />
          <circle cx="131" cy="93" r="1.4" fill="rgba(255,255,255,0.52)" />
          <ellipse cx="126" cy="79.5" rx="17" ry="5" fill="rgba(6,2,12,0.22)" />
        </g>

        {/* ── EYELASHES ── */}
        <path className="jb-lash-left"
          d="M 57 83 C 66 70 84 70 91 82"
          stroke={OL} strokeWidth="3" strokeLinecap="round" fill="none" />
        <path className="jb-lash-right"
          d="M 109 82 C 116 70 134 70 143 83"
          stroke={OL} strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* ── NOSE — minimal ── */}
        <ellipse cx="95" cy="116" rx="2.5" ry="1.8" fill="rgba(170,110,80,0.36)" />
        <ellipse cx="105" cy="116" rx="2.5" ry="1.8" fill="rgba(170,110,80,0.36)" />

        {/* ── LIPS — natural rose ── */}
        <path d="M 83 136 Q 90 127 100 130 Q 110 127 117 136 Q 109 139 100 138 Q 91 139 83 136 Z"
          fill="url(#jb-lip-grad)" stroke={OL} strokeWidth="1" />
        <path d="M 83 136 Q 91 150 100 152 Q 109 150 117 136 Q 109 139 100 138 Q 91 139 83 136 Z"
          fill="#A05868" stroke={OL} strokeWidth="1" />
        <ellipse cx="100" cy="143" rx="10" ry="3" fill="rgba(255,220,210,0.26)" />

        {/* ── ROBOT HEAD ELEMENTS ── */}
        {/* Right temple circuit trace */}
        <path d="M 141 87 L 147 96 L 145 110"
          stroke="rgba(68,184,173,0.72)" strokeWidth="1.2"
          fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Circuit nodes */}
        <circle cx="141" cy="87" r="1.6" fill="rgba(68,184,173,0.65)" />
        {/* Temple LED */}
        <circle className="jb-led" cx="145" cy="110" r="2.2"
          fill="#44B8AD" filter="url(#jb-led-glow)" />

        {/* Right earpiece — implant on bob panel */}
        <circle cx="150" cy="118" r="7"
          fill="#0E1E1C" stroke="rgba(68,184,173,0.82)" strokeWidth="1.5" />
        <circle cx="150" cy="118" r="4"
          fill="#142220" stroke="rgba(68,184,173,0.40)" strokeWidth="1" />
        <circle className="jb-led" cx="150" cy="118" r="2"
          fill="#44B8AD" filter="url(#jb-led-glow)" />
        {/* Earpiece connector pin */}
        <line x1="150" y1="111" x2="150" y2="106"
          stroke="rgba(68,184,173,0.48)" strokeWidth="1.5" strokeLinecap="round" />

        {/* Forehead tech line — slightly more visible */}
        <line x1="86" y1="40" x2="114" y2="40"
          stroke="rgba(68,184,173,0.20)" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="86" cy="40" r="1.2" fill="rgba(68,184,173,0.28)" />
        <circle cx="114" cy="40" r="1.2" fill="rgba(68,184,173,0.28)" />
      </g>
      {/* ── END HEAD GROUP ── */}

      {/* ── NECK ── */}
      <path d="M 86 166 L 82 200 L 118 200 L 114 166 Z"
        fill="url(#jb-skin-grad)" stroke={OL} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 86 166 L 84 190 L 82 200 L 86 200 Z" fill="rgba(170,120,80,0.13)" />
      <path d="M 114 166 L 116 190 L 118 200 L 114 200 Z" fill="rgba(170,120,80,0.13)" />

      {/* ── TECH COLLAR ── */}
      <rect x="74" y="196" width="52" height="14" rx="7" fill="#0C1A18" />
      <rect x="74" y="196" width="52" height="14" rx="7"
        fill="none" stroke="rgba(68,184,173,0.80)" strokeWidth="1.5" />
      <rect x="76" y="198" width="18" height="10" rx="3"
        fill="rgba(68,184,173,0.06)" stroke="rgba(68,184,173,0.26)" strokeWidth="0.8" />
      <rect x="106" y="198" width="18" height="10" rx="3"
        fill="rgba(68,184,173,0.06)" stroke="rgba(68,184,173,0.26)" strokeWidth="0.8" />
      <line x1="74" y1="203" x2="126" y2="203" stroke="rgba(68,184,173,0.18)" strokeWidth="6" />
      <circle className="jb-led" cx="87" cy="203" r="2.5" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led jb-led-2" cx="100" cy="203" r="3" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led" cx="113" cy="203" r="2.5" fill="#44B8AD" filter="url(#jb-led-glow)" />

      {/* ── ROBOT BODY / CHEST — improved ── */}
      <path
        d="M 0 256 Q 26 218 68 212 L 82 202 L 100 214 L 118 202 L 132 212 Q 174 218 200 256 L 200 300 L 0 300 Z"
        fill="url(#jb-armor-grad)" stroke={OL} strokeWidth="1.2" strokeLinejoin="round"
      />
      {/* Shoulder highlights */}
      <path d="M 0 262 Q 20 224 60 218 L 68 215 L 68 217 Q 34 224 6 262 Z"
        fill="rgba(255,255,255,0.26)" />
      <path d="M 200 262 Q 180 224 140 218 L 132 215 L 132 217 Q 166 224 194 262 Z"
        fill="rgba(255,255,255,0.26)" />
      {/* Shoulder joint circles — visible articulation */}
      <circle cx="70" cy="218" r="5"
        fill="#0E1A22" stroke="rgba(68,184,173,0.65)" strokeWidth="1.5" />
      <circle cx="70" cy="218" r="2.2" fill="rgba(68,184,173,0.40)" />
      <circle cx="130" cy="218" r="5"
        fill="#0E1A22" stroke="rgba(68,184,173,0.65)" strokeWidth="1.5" />
      <circle cx="130" cy="218" r="2.2" fill="rgba(68,184,173,0.40)" />
      {/* Shoulder joint arcs */}
      <path d="M 65 213 Q 60 222 64 230"
        stroke="rgba(68,184,173,0.45)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M 135 213 Q 140 222 136 230"
        stroke="rgba(68,184,173,0.45)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Décolleté V */}
      <path d="M 82 202 L 100 222 L 118 202" fill="rgba(130,70,30,0.12)" />

      {/* Chest center plate */}
      <rect x="64" y="222" width="72" height="68" rx="10"
        fill="url(#jb-armor-plate)" stroke={OL} strokeWidth="1" />
      {/* Vertical panel dividers */}
      <line x1="88" y1="225" x2="88" y2="288" stroke="rgba(68,184,173,0.22)" strokeWidth="1" />
      <line x1="112" y1="225" x2="112" y2="288" stroke="rgba(68,184,173,0.22)" strokeWidth="1" />
      {/* Horizontal panel divider */}
      <line x1="66" y1="246" x2="134" y2="246" stroke="rgba(68,184,173,0.28)" strokeWidth="1" />
      {/* Circuit traces — top panels */}
      <line x1="68" y1="235" x2="86" y2="235" stroke="rgba(68,184,173,0.52)" strokeWidth="1.4" />
      <line x1="114" y1="235" x2="132" y2="235" stroke="rgba(68,184,173,0.52)" strokeWidth="1.4" />
      <circle cx="86" cy="235" r="1.5" fill="rgba(68,184,173,0.52)" />
      <circle cx="114" cy="235" r="1.5" fill="rgba(68,184,173,0.52)" />
      {/* Plate border glow */}
      <rect x="64" y="222" width="72" height="68" rx="10"
        fill="none" stroke="rgba(68,184,173,0.18)" strokeWidth="1.5" />

      {/* POWER CORE — center chest, glowing teal */}
      <circle cx="100" cy="260" r="13"
        fill="url(#jb-core-grad)" filter="url(#jb-core-glow)" />
      <circle cx="100" cy="260" r="13"
        fill="none" stroke="rgba(68,184,173,0.85)" strokeWidth="1.5" />
      {/* Hexagonal overlay */}
      <polygon
        points="100,250 108.7,255 108.7,265 100,270 91.3,265 91.3,255"
        fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
      {/* Core bright center */}
      <circle cx="100" cy="260" r="4.5" fill="rgba(200,255,250,0.72)" />

      {/* Status LEDs — bottom corners */}
      <line x1="72" y1="276" x2="72" y2="269" stroke="rgba(68,184,173,0.38)" strokeWidth="1" />
      <circle className="jb-led jb-chest-led-1" cx="72" cy="280" r="4.5"
        fill="#44B8AD" filter="url(#jb-led-glow)" />
      <line x1="128" y1="276" x2="128" y2="269" stroke="rgba(68,184,173,0.38)" strokeWidth="1" />
      <circle className="jb-led jb-chest-led-3" cx="128" cy="280" r="4.5"
        fill="#44B8AD" filter="url(#jb-led-glow)" />

      {/* Plate edge highlight */}
      <rect x="64" y="222" width="72" height="68" rx="10"
        fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
    </svg>
  )
}
