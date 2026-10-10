import Image from 'next/image'

interface VenturaLogoProps {
  // 'dark' is the ink wordmark for light grounds; 'light' is white, for the sky and ink panels.
  // Both have transparent grounds so they sit cleanly on frosted or tinted surfaces.
  variant?: 'dark' | 'light'
  height?: number
  className?: string
}

// Cropped logo dimensions: 2695 × 400
const ASPECT = 2695 / 400

export default function VenturaLogo({ variant = 'dark', height = 32, className = '' }: VenturaLogoProps) {
  const width = Math.round(height * ASPECT)
  const src   = variant === 'light' ? '/ventura-logo-white.png' : '/ventura-logo-dark.png'

  return (
    <Image
      src={src}
      alt="Ventura"
      width={width}
      height={height}
      className={className}
      style={{ display: 'block' }}
      priority
    />
  )
}
