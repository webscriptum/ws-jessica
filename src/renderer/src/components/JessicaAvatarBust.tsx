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
        {/* Skin gradients */}
        <linearGradient id="jb-skin-grad" x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#F8D4AE" />
          <stop offset="45%" stopColor="#EDBA88" />
          <stop offset="100%" stopColor="#C8773C" />
        </linearGradient>
        <radialGradient id="jb-skin-forehead" cx="50%" cy="22%" r="55%">
          <stop offset="0%" stopColor="rgba(255,238,208,0.60)" />
          <stop offset="100%" stopColor="rgba(255,210,160,0)" />
        </radialGradient>
        <radialGradient id="jb-blush-l" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(222,98,76,0.24)" />
          <stop offset="100%" stopColor="rgba(222,98,76,0)" />
        </radialGradient>
        <radialGradient id="jb-blush-r" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(222,98,76,0.24)" />
          <stop offset="100%" stopColor="rgba(222,98,76,0)" />
        </radialGradient>

        {/* Hair */}
        <linearGradient id="jb-hair-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2E0E24" />
          <stop offset="55%" stopColor="#160810" />
          <stop offset="100%" stopColor="#0C0408" />
        </linearGradient>
        <radialGradient id="jb-hair-shine" cx="42%" cy="18%" r="50%">
          <stop offset="0%" stopColor="rgba(185,105,145,0.50)" />
          <stop offset="55%" stopColor="rgba(140,60,100,0.18)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>

        {/* Armor */}
        <linearGradient id="jb-armor-grad" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#EAF0F6" />
          <stop offset="50%" stopColor="#CDD6E0" />
          <stop offset="100%" stopColor="#B0BCC8" />
        </linearGradient>
        <linearGradient id="jb-armor-plate" x1="0%" y1="0%" x2="30%" y2="100%">
          <stop offset="0%" stopColor="#D8E2EA" />
          <stop offset="100%" stopColor="#BEC8D4" />
        </linearGradient>

        {/* Iris */}
        <radialGradient id="jb-iris-l" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#5A3828" />
          <stop offset="55%" stopColor="#1E0E0C" />
          <stop offset="100%" stopColor="#0C0408" />
        </radialGradient>
        <radialGradient id="jb-iris-r" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#5A3828" />
          <stop offset="55%" stopColor="#1E0E0C" />
          <stop offset="100%" stopColor="#0C0408" />
        </radialGradient>

        {/* Lips */}
        <linearGradient id="jb-lip-up" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#A04456" />
          <stop offset="100%" stopColor="#C45E6C" />
        </linearGradient>
        <linearGradient id="jb-lip-lo" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#C45E6C" />
          <stop offset="100%" stopColor="#984050" />
        </linearGradient>

        {/* Filters */}
        <filter id="jb-led-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="jb-soft-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="jb-shadow-blur">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* ── HEAD GROUP ── */}
      <g className="jb-head">

        {/* ── HAIR (behind face) ── */}
        <g className="jb-hair">
          {/* Top dome */}
          <ellipse cx="100" cy="42" rx="56" ry="36" fill="url(#jb-hair-grad)" />
          {/* Left bob panel */}
          <rect x="44" y="52" width="24" height="112" rx="12" fill="url(#jb-hair-grad)" />
          {/* Right bob panel */}
          <rect x="132" y="52" width="24" height="112" rx="12" fill="url(#jb-hair-grad)" />
          {/* Fringe/bangs */}
          <path d="M 50 32 Q 100 18 150 32 L 150 60 Q 100 68 50 60 Z" fill="url(#jb-hair-grad)" />
          {/* Radial gloss shine */}
          <ellipse cx="100" cy="42" rx="56" ry="36" fill="url(#jb-hair-shine)" />
          {/* Fine highlight strands */}
          <path d="M 56 40 Q 72 30 90 40" stroke="rgba(200,140,170,0.30)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 78 26 Q 100 18 122 26" stroke="rgba(200,140,170,0.20)" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 65 48 Q 80 42 95 48" stroke="rgba(200,150,175,0.18)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          {/* Side highlight streaks */}
          <ellipse cx="57" cy="57" rx="8" ry="28" fill="rgba(148,48,98,0.22)" />
          <ellipse cx="143" cy="57" rx="7" ry="22" fill="rgba(148,48,98,0.16)" />
          {/* Root depth shadow */}
          <ellipse cx="100" cy="69" rx="44" ry="10" fill="rgba(0,0,0,0.20)" filter="url(#jb-shadow-blur)" />
        </g>

        {/* ── FACE OVAL ── */}
        <ellipse cx="100" cy="106" rx="52" ry="64" fill="url(#jb-skin-grad)" />

        {/* Forehead highlight */}
        <ellipse cx="100" cy="76" rx="28" ry="18" fill="url(#jb-skin-forehead)" />

        {/* Temporal (side) shadows */}
        <ellipse cx="52" cy="108" rx="13" ry="34" fill="rgba(138,62,18,0.15)" />
        <ellipse cx="148" cy="108" rx="13" ry="34" fill="rgba(138,62,18,0.15)" />

        {/* Cheek blush */}
        <ellipse cx="64" cy="122" rx="23" ry="13" fill="url(#jb-blush-l)" />
        <ellipse cx="136" cy="122" rx="23" ry="13" fill="url(#jb-blush-r)" />

        {/* Chin shadow */}
        <ellipse cx="100" cy="167" rx="30" ry="9" fill="rgba(136,68,18,0.16)" />

        {/* ── EYEBROWS ── */}
        <path d="M 58 71 Q 72 62 92 66" stroke="#180C14" strokeWidth="4.2" fill="none" strokeLinecap="round" />
        <path d="M 108 66 Q 128 62 142 71" stroke="#180C14" strokeWidth="4.2" fill="none" strokeLinecap="round" />
        {/* Eyebrow inner warm tone */}
        <path d="M 59 72 Q 72 64 91 67" stroke="rgba(80,28,48,0.40)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M 109 67 Q 128 64 141 72" stroke="rgba(80,28,48,0.40)" strokeWidth="2.2" fill="none" strokeLinecap="round" />

        {/* ── LEFT EYE ── */}
        <g className="jb-eye-left">
          {/* Sclera */}
          <ellipse cx="74" cy="88" rx="17" ry="12" fill="#F6F5F1" />
          {/* Sclera bottom warm shadow */}
          <ellipse cx="74" cy="92" rx="16" ry="7" fill="rgba(198,185,170,0.20)" />
          {/* Limbal ring */}
          <circle cx="74" cy="89" r="11.5" fill="#080306" />
          {/* Iris */}
          <circle cx="74" cy="89" r="10.5" fill="url(#jb-iris-l)" />
          {/* Mid iris ring */}
          <circle cx="74" cy="89" r="7.5" fill="#1A0C0A" />
          {/* Pupil */}
          <circle cx="74" cy="89" r="5.2" fill="#040102" />
          {/* Teal AI shimmer */}
          <circle cx="74" cy="89" r="3" fill="rgba(68,184,173,0.30)" />
          {/* Main catchlight */}
          <circle cx="67" cy="83" r="3.2" fill="rgba(255,255,255,0.96)" />
          {/* Secondary catchlight */}
          <circle cx="80" cy="93" r="1.4" fill="rgba(255,255,255,0.50)" />
          {/* Upper lid shadow */}
          <ellipse cx="74" cy="80" rx="16" ry="5" fill="rgba(5,2,10,0.32)" />
          {/* Eyelid crease */}
          <path d="M 58 86 Q 74 80 90 86" stroke="rgba(175,125,95,0.24)" strokeWidth="1" fill="none" />
        </g>

        {/* ── RIGHT EYE ── */}
        <g className="jb-eye-right">
          <ellipse cx="126" cy="88" rx="17" ry="12" fill="#F6F5F1" />
          <ellipse cx="126" cy="92" rx="16" ry="7" fill="rgba(198,185,170,0.20)" />
          <circle cx="126" cy="89" r="11.5" fill="#080306" />
          <circle cx="126" cy="89" r="10.5" fill="url(#jb-iris-r)" />
          <circle cx="126" cy="89" r="7.5" fill="#1A0C0A" />
          <circle cx="126" cy="89" r="5.2" fill="#040102" />
          <circle cx="126" cy="89" r="3" fill="rgba(68,184,173,0.30)" />
          <circle cx="119" cy="83" r="3.2" fill="rgba(255,255,255,0.96)" />
          <circle cx="132" cy="93" r="1.4" fill="rgba(255,255,255,0.50)" />
          <ellipse cx="126" cy="80" rx="16" ry="5" fill="rgba(5,2,10,0.32)" />
          <path d="M 110 86 Q 126 80 142 86" stroke="rgba(175,125,95,0.24)" strokeWidth="1" fill="none" />
        </g>

        {/* ── EYELASHES — individual strokes ── */}
        <g className="jb-lash-left" stroke="#07030D" strokeLinecap="round" fill="none">
          <path d="M 58 82 Q 74 74 90 83" strokeWidth="2.4" />
          <line x1="59" y1="81" x2="54" y2="72" strokeWidth="1.8" />
          <line x1="65" y1="78" x2="62" y2="69" strokeWidth="1.8" />
          <line x1="72" y1="76" x2="71" y2="67" strokeWidth="1.8" />
          <line x1="79" y1="77" x2="80" y2="68" strokeWidth="1.6" />
          <line x1="85" y1="80" x2="89" y2="73" strokeWidth="1.6" />
          <line x1="89" y1="83" x2="94" y2="78" strokeWidth="1.4" />
        </g>
        <g className="jb-lash-right" stroke="#07030D" strokeLinecap="round" fill="none">
          <path d="M 110 83 Q 126 74 142 82" strokeWidth="2.4" />
          <line x1="111" y1="83" x2="106" y2="78" strokeWidth="1.4" />
          <line x1="115" y1="80" x2="111" y2="73" strokeWidth="1.6" />
          <line x1="121" y1="77" x2="120" y2="68" strokeWidth="1.8" />
          <line x1="128" y1="76" x2="129" y2="67" strokeWidth="1.8" />
          <line x1="135" y1="78" x2="138" y2="69" strokeWidth="1.8" />
          <line x1="141" y1="81" x2="146" y2="72" strokeWidth="1.8" />
        </g>

        {/* ── NOSE ── */}
        {/* Bridge side shadow */}
        <path d="M 97 96 Q 95 107 94 114 Q 96 121 100 123 Q 104 121 106 114 Q 105 107 103 96"
          stroke="rgba(142,72,32,0.20)" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Tip highlight */}
        <ellipse cx="100" cy="120" rx="4" ry="2.5" fill="rgba(255,232,200,0.42)" />
        {/* Nostrils */}
        <ellipse cx="94" cy="117" rx="2.5" ry="1.8" fill="rgba(128,60,28,0.44)" />
        <ellipse cx="106" cy="117" rx="2.5" ry="1.8" fill="rgba(128,60,28,0.44)" />

        {/* ── PHILTRUM SHADOWS ── */}
        <path d="M 96 124 L 96 131" stroke="rgba(138,62,48,0.22)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <path d="M 104 124 L 104 131" stroke="rgba(138,62,48,0.22)" strokeWidth="1.4" fill="none" strokeLinecap="round" />

        {/* ── LIPS ── */}
        {/* Upper lip */}
        <path d="M 82 136 Q 89 127 100 130 Q 111 127 118 136 Q 110 140 100 139 Q 90 140 82 136 Z"
          fill="url(#jb-lip-up)" />
        {/* Lower lip */}
        <path d="M 82 136 Q 90 151 100 153 Q 110 151 118 136 Q 110 140 100 139 Q 90 140 82 136 Z"
          fill="url(#jb-lip-lo)" />
        {/* Lower lip highlight — broad */}
        <ellipse cx="100" cy="144" rx="10" ry="3.5" fill="rgba(255,215,205,0.38)" />
        {/* Lower lip highlight — sharp center */}
        <ellipse cx="100" cy="143" rx="4" ry="1.8" fill="rgba(255,228,218,0.58)" />
        {/* Lip corner shadows */}
        <ellipse cx="83" cy="136" rx="3" ry="2" fill="rgba(108,32,44,0.32)" />
        <ellipse cx="117" cy="136" rx="3" ry="2" fill="rgba(108,32,44,0.32)" />
        {/* Cupid's bow edge */}
        <path d="M 82 136 Q 91 128 100 130 Q 109 128 118 136"
          stroke="rgba(138,48,62,0.48)" strokeWidth="0.8" fill="none" />

        {/* Subtle forehead tech accent */}
        <line x1="88" y1="40" x2="112" y2="40" stroke="rgba(68,184,173,0.10)" strokeWidth="1" strokeLinecap="round" />
      </g>
      {/* ── END HEAD GROUP ── */}

      {/* ── NECK ── */}
      <path d="M 86 168 L 82 202 L 118 202 L 114 168 Z" fill="url(#jb-skin-grad)" />
      {/* Neck side shadows */}
      <path d="M 86 168 L 84 192 L 82 202 L 86 202 Z" fill="rgba(138,62,22,0.20)" />
      <path d="M 114 168 L 116 192 L 118 202 L 114 202 Z" fill="rgba(138,62,22,0.20)" />
      {/* Center vertical neck shadow */}
      <line x1="100" y1="169" x2="100" y2="200" stroke="rgba(138,62,22,0.11)" strokeWidth="5" strokeLinecap="round" />
      {/* Under-chin shadow */}
      <ellipse cx="100" cy="170" rx="28" ry="6" fill="rgba(78,32,8,0.20)" />

      {/* ── TECH COLLAR ── */}
      <rect x="74" y="197" width="52" height="16" rx="8" fill="#0C1A18" />
      <rect x="74" y="197" width="52" height="16" rx="8" fill="none" stroke="rgba(68,184,173,0.80)" strokeWidth="1.5" />
      {/* Side panel details */}
      <rect x="76" y="199" width="18" height="12" rx="3" fill="rgba(68,184,173,0.07)" stroke="rgba(68,184,173,0.28)" strokeWidth="0.8" />
      <rect x="106" y="199" width="18" height="12" rx="3" fill="rgba(68,184,173,0.07)" stroke="rgba(68,184,173,0.28)" strokeWidth="0.8" />
      {/* Ambient glow */}
      <line x1="74" y1="205" x2="126" y2="205" stroke="rgba(68,184,173,0.18)" strokeWidth="6" />
      {/* Collar LEDs */}
      <circle className="jb-led" cx="88" cy="205" r="2.5" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led jb-led-2" cx="100" cy="205" r="3" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led" cx="112" cy="205" r="2.5" fill="#44B8AD" filter="url(#jb-led-glow)" />

      {/* ── ROBOT BODY / CHEST ── */}
      <path
        d="M 0 258 Q 26 220 68 214 L 82 204 L 100 216 L 118 204 L 132 214 Q 174 220 200 258 L 200 300 L 0 300 Z"
        fill="url(#jb-armor-grad)"
      />
      {/* Shoulder highlights */}
      <path d="M 0 264 Q 20 226 60 220 L 68 217 L 68 219 Q 34 226 6 264 Z" fill="rgba(255,255,255,0.26)" />
      <path d="M 200 264 Q 180 226 140 220 L 132 217 L 132 219 Q 166 226 194 264 Z" fill="rgba(255,255,255,0.26)" />
      {/* Shoulder depth shadow */}
      <path d="M 0 265 Q 20 233 60 225 L 60 221 Q 22 229 0 271 Z" fill="rgba(0,0,0,0.09)" />
      <path d="M 200 265 Q 180 233 140 225 L 140 221 Q 178 229 200 271 Z" fill="rgba(0,0,0,0.09)" />
      {/* Décolleté V shadow */}
      <path d="M 82 204 L 100 224 L 118 204" fill="rgba(148,78,38,0.13)" />

      {/* Chest center armor plate */}
      <rect x="64" y="224" width="72" height="66" rx="10" fill="url(#jb-armor-plate)" />
      {/* Inner panel inset */}
      <rect x="68" y="228" width="64" height="58" rx="7" fill="none" stroke="rgba(68,184,173,0.20)" strokeWidth="1" />
      {/* Plate outer border */}
      <rect x="64" y="224" width="72" height="66" rx="10" fill="none" stroke="rgba(68,184,173,0.16)" strokeWidth="1.5" />

      {/* Circuit lines */}
      <line x1="76" y1="240" x2="124" y2="240" stroke="rgba(68,184,173,0.55)" strokeWidth="1.5" />
      <line x1="76" y1="252" x2="118" y2="252" stroke="rgba(68,184,173,0.36)" strokeWidth="1" />
      <line x1="76" y1="264" x2="120" y2="264" stroke="rgba(68,184,173,0.36)" strokeWidth="1" />
      <circle cx="124" cy="252" r="2" fill="rgba(68,184,173,0.45)" />
      <circle cx="120" cy="264" r="2" fill="rgba(68,184,173,0.45)" />

      {/* Status LEDs */}
      <circle className="jb-led jb-chest-led-1" cx="77" cy="280" r="5" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led jb-chest-led-2" cx="100" cy="280" r="5" fill="#44B8AD" filter="url(#jb-led-glow)" />
      <circle className="jb-led jb-chest-led-3" cx="123" cy="280" r="5" fill="#44B8AD" filter="url(#jb-led-glow)" />

      {/* Plate top-edge highlight */}
      <rect x="64" y="224" width="72" height="66" rx="10" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="1" />
    </svg>
  )
}
