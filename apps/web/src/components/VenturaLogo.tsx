import Image from 'next/image'

interface VenturaLogoProps {
  variant?: 'dark' | 'light'
  height?: number
  className?: string
}

// Cropped logo dimensions: 2695 × 400
const ASPECT = 2695 / 400

export default function VenturaLogo({ variant = 'light', height = 32, className = '' }: VenturaLogoProps) {
  const width = Math.round(height * ASPECT)
  const src   = variant === 'light' ? '/ventura-logo-white.png' : '/ventura-logo.png'

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
