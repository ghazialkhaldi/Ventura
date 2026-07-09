import Image from 'next/image'

interface VenturaLogoProps {
  variant?: 'dark' | 'light'
  height?: number
  className?: string
}

// Cropped logo dimensions: 2695 × 400
const ASPECT = 2695 / 400

export default function VenturaLogo({ variant = 'dark', height = 28, className = '' }: VenturaLogoProps) {
  const width = Math.round(height * ASPECT)

  return (
    <Image
      src="/ventura-logo.png"
      alt="Ventura"
      width={width}
      height={height}
      className={className}
      style={variant === 'light' ? { filter: 'invert(1)', mixBlendMode: 'screen' } : undefined}
      priority
    />
  )
}
