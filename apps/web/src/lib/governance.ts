// Shared with ai-governance.tsx, which owns the settings UI and writes this
// key. Before this file existed, every page that needed to know what counts
// as "high-confidence" hardcoded the number 85 independently — which meant
// the confidence-threshold slider on the AI Governance page had zero effect
// anywhere else in the product. This is the single source of truth so the
// setting actually does something.
const GOVERNANCE_KEY = 'sf_governance'
export const DEFAULT_CONFIDENCE_THRESHOLD = 85

export function getConfidenceThreshold(): number {
  if (typeof window === 'undefined') return DEFAULT_CONFIDENCE_THRESHOLD
  try {
    const raw = localStorage.getItem(GOVERNANCE_KEY)
    if (!raw) return DEFAULT_CONFIDENCE_THRESHOLD
    const saved = JSON.parse(raw) as { threshold?: number }
    return typeof saved.threshold === 'number' ? saved.threshold : DEFAULT_CONFIDENCE_THRESHOLD
  } catch {
    return DEFAULT_CONFIDENCE_THRESHOLD
  }
}
