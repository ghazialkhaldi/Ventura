/**
 * Scores the engine against the scenarios: what it catches (recall on the
 * planted problems) and what it raises on routine spend (precision).
 * Run with `npm run eval:engine`.
 */
import { runAnomalyDetection } from '../../src/lib/anomalyEngine'
import type { DetectedAnomaly } from '../../src/lib/dataStore'
import { SCENARIOS, type Scenario } from './fixtures'

/** The rows a finding actually flags. A duplicate's later rows are the original, carried as evidence. */
export function flaggedRows(f: DetectedAnomaly): string[] {
  return f.type === 'duplicate' ? f.rowRefs.slice(0, 1) : f.rowRefs
}

export function score(s: Scenario, findings: DetectedAnomaly[]) {
  const plantedRows = new Set(s.planted.flatMap(p => p.rows))
  const tp = findings.filter(f => flaggedRows(f).some(r => plantedRows.has(r)))
  const fp = findings.filter(f => !flaggedRows(f).some(r => plantedRows.has(r)))
  const caught = s.planted.map(p => ({
    p,
    // A plant also counts when its rule fired and was merged into a stronger finding on the same rows.
    hit: findings.some(f => (p.types.includes(f.type) || (f.alsoMatched ?? []).some(m => p.types.includes(m.type))) && flaggedRows(f).some(r => p.rows.includes(r))),
  }))
  const required = caught.filter(c => c.p.required !== false)
  return { tp, fp, caught, required, recall: required.filter(c => c.hit).length / Math.max(1, required.length), precision: tp.length / Math.max(1, findings.length) }
}

if (require.main === module) {
  for (const make of SCENARIOS) {
    const s = make()
    const findings = runAnomalyDetection(s.txs)
    const r = score(s, findings)
    const sev = (fs: DetectedAnomaly[]) => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(k => `${k[0]}${fs.filter(f => f.severity === k).length}`).join(' ')
    console.log(`\n━━ ${s.name}: ${s.txs.length} rows`)
    console.log(`  findings ${findings.length} (${sev(findings)})   correct ${r.tp.length}   wrong ${r.fp.length}   precision ${(r.precision * 100).toFixed(0)}%   recall ${(r.recall * 100).toFixed(0)}% (${r.required.filter(c => c.hit).length}/${r.required.length})`)
    for (const c of r.caught) console.log(`  ${c.hit ? '✓' : c.p.required === false ? '·' : '✗'} ${c.p.key}`)
    const byType = new Map<string, DetectedAnomaly[]>()
    for (const f of r.fp) byType.set(f.type, [...(byType.get(f.type) ?? []), f])
    for (const [t, fs] of byType) {
      console.log(`  wrong ${t} ×${fs.length}: ${[...new Set(fs.map(f => f.vendor))].slice(0, 8).join(', ')}${fs.length > 8 ? ' …' : ''}`)
    }
  }
}

// ── Randomised registers: `node eval.js random [seeds]` ──────────────────────
import { randomRegister } from './random'
if (require.main === module && process.argv[2] === 'random') {
  const seeds = Number(process.argv[3] ?? 12)
  let found = 0, right = 0, req = 0, hit = 0
  const wrongByType = new Map<string, string[]>()
  const missed: string[] = []
  for (let seed = 1; seed <= seeds; seed++) {
    const s = randomRegister(seed)
    const findings = runAnomalyDetection(s.txs)
    const r = score(s, findings)
    found += findings.length; right += r.tp.length; req += r.required.length; hit += r.required.filter(c => c.hit).length
    for (const c of r.required) if (!c.hit) missed.push(`seed ${seed}: ${c.p.key}`)
    for (const f of r.fp) wrongByType.set(f.type, [...(wrongByType.get(f.type) ?? []), `seed ${seed} ${f.severity} ${f.confidence}: ${f.description}`])
    console.log(`seed ${String(seed).padStart(2)}  rows ${String(s.txs.length).padStart(4)}  findings ${String(findings.length).padStart(3)}  correct ${String(r.tp.length).padStart(3)}  wrong ${String(r.fp.length).padStart(3)}  recall ${r.required.filter(c => c.hit).length}/${r.required.length}`)
  }
  console.log(`\nTOTAL  findings ${found}  precision ${((right / found) * 100).toFixed(1)}%  recall ${((hit / req) * 100).toFixed(1)}% (${hit}/${req})`)
  if (missed.length) console.log('\nMISSED\n  ' + missed.join('\n  '))
  for (const [t, xs] of wrongByType) console.log(`\nNOT PLANTED: ${t} ×${xs.length}\n  ` + xs.slice(0, 12).join('\n  '))
}
