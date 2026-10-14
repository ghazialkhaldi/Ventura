/**
 * Seventeen realistic companies, scored: `node .test-build/test/engine/companies.js [seed] [detail]`.
 */
import { runAnomalyDetection } from '../../src/lib/anomalyEngine'
import type { DetectedAnomaly } from '../../src/lib/dataStore'
import type { Scenario } from './fixtures'
import { score } from './eval'
import * as A from './companies-a'
import * as B from './companies-b'

export const COMPANIES: ((seed: number) => Scenario)[] = [
  A.bakery, A.designAgency, A.dentalClinic, A.saasStartup, A.construction, A.restaurantGroup,
  A.manufacturer, A.logistics, A.retailChain, B.hospital, B.nonprofit, B.lawFirm, B.ecommerce,
  B.propertyManager, B.farm, B.universityPCard, B.enterprise,
]

export interface CompanyResult {
  name: string; rows: number; ms: number; findings: number; correct: number; wrong: number
  caught: number; required: number; missed: string[]; noise: DetectedAnomaly[]
}

export function runCompany(make: (seed: number) => Scenario, seed: number): CompanyResult {
  const s = make(seed)
  const t0 = Date.now()
  const f = runAnomalyDetection(s.txs)
  const ms = Date.now() - t0
  const r = score(s, f)
  return {
    name: s.name, rows: s.txs.length, ms, findings: f.length, correct: r.tp.length, wrong: r.fp.length,
    caught: r.required.filter(c => c.hit).length, required: r.required.length,
    missed: r.required.filter(c => !c.hit).map(c => c.p.key), noise: r.fp,
  }
}

if (require.main === module) {
  const seed = Number(process.argv[2] ?? 1)
  const detail = process.argv[3] === 'detail'
  let F = 0, C = 0, Q = 0, H = 0, rows = 0
  console.log(`seed ${seed}`)
  console.log('company'.padEnd(46) + 'rows'.padStart(8) + '   ms' + '  found' + '  right' + '  wrong' + '  recall')
  for (const make of COMPANIES) {
    const r = runCompany(make, seed)
    F += r.findings; C += r.correct; Q += r.required; H += r.caught; rows += r.rows
    console.log(r.name.padEnd(46) + String(r.rows).padStart(8) + String(r.ms).padStart(5) + String(r.findings).padStart(7) + String(r.correct).padStart(7) + String(r.wrong).padStart(7) + `   ${r.caught}/${r.required}`)
    if (detail) {
      for (const m of r.missed) console.log(`      MISSED  ${m}`)
      for (const f of r.noise.slice(0, 8)) console.log(`      NOISE   ${f.type} ${f.severity} ${f.confidence}: ${f.description.slice(0, 150)}`)
      if (r.noise.length > 8) console.log(`      … ${r.noise.length - 8} more`)
    }
  }
  console.log(`\nALL  rows ${rows}  findings ${F}  precision ${((C / F) * 100).toFixed(1)}%  recall ${((H / Q) * 100).toFixed(1)}% (${H}/${Q})`)
}
