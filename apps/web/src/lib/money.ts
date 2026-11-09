// Amounts as the workspace's currency. Files rarely say what currency they are
// in, so this comes from the workspace setting, or from the first file that does.
import { CURRENCY_SYMBOLS, DEFAULT_DETECTION_CONFIG } from './detectionConfig'
import { getDetectionConfig } from './workspaceSettings'

export function currencyCode(): string {
  return getDetectionConfig().currency ?? DEFAULT_DETECTION_CONFIG.currency
}

export const currencySymbol = () => CURRENCY_SYMBOLS[currencyCode()] ?? '$'

/** $1.2M, $45K, $900. */
export function moneyShort(n: number): string {
  const s = currencySymbol()
  if (n >= 1_000_000) return s + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return s + (n / 1_000).toFixed(0) + 'K'
  return s + n.toFixed(0)
}

/** $1,234 to the whole unit. */
export function moneyFull(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: currencyCode(), maximumFractionDigits: 0 })
}
