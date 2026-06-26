interface Props {
  size?: number
}

export default function JessicaAvatar({ size = 32 }: Props): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="jg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5BCBC0" />
          <stop offset="100%" stopColor="#2FA89B" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill="url(#jg)" />
      <ellipse cx="14" cy="13" rx="7" ry="5" fill="rgba(255,255,255,0.1)" />
      <circle cx="14" cy="17" r="2.5" fill="rgba(255,255,255,0.95)" />
      <circle cx="26" cy="17" r="2.5" fill="rgba(255,255,255,0.95)" />
      <path
        d="M13 24 Q20 30.5 27 24"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}
