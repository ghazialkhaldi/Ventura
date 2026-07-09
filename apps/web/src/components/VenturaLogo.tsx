interface VenturaLogoProps {
  variant?: 'dark' | 'light'
  size?: string
  className?: string
}

export default function VenturaLogo({ variant = 'dark', size = '1.5rem', className = '' }: VenturaLogoProps) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700,
        letterSpacing: '0.08em',
        fontSize: size,
        color: variant === 'light' ? '#ffffff' : '#0a0a0a',
        lineHeight: 1,
        display: 'inline-block',
      }}
    >
      VENTURA
    </span>
  )
}
