// The workspace's detection settings, as the browser knows them. The server
// (workspace_settings, migration 003) is the record once it exists; this copy
// lets every analysis run use the same settings without waiting on a request.
import type { DetectionConfig } from './detectionConfig'

const KEY = 'sf_detection_config'

export function getDetectionConfig(): Partial<DetectionConfig> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<DetectionConfig> } catch { return {} }
}

export function setDetectionConfig(cfg: Partial<DetectionConfig>) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)) } catch { /* private mode: settings last for this page */ }
}

/** Load the workspace's settings from the server, when it keeps them, into the local copy. */
export async function refreshDetectionConfig(): Promise<Partial<DetectionConfig>> {
  try {
    const r = await fetch('/api/workspace/settings')
    if (r.ok) {
      const j = await r.json()
      if (j.stored && j.config) setDetectionConfig(j.config)
    }
  } catch { /* offline: keep the local copy */ }
  return getDetectionConfig()
}
