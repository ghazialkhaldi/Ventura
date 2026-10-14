/** Times the engine on a large register: `node .test-build/test/engine/perf.js [rows]`. */
import { runAnomalyDetection } from '../../src/lib/anomalyEngine'
import type { StoredTransaction } from '../../src/lib/dataStore'

export function bigRegister(rows: number): StoredTransaction[] {
  let s = 42
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647
  const txs: StoredTransaction[] = []
  const vendors = Array.from({ length: Math.max(50, Math.round(rows / 40)) }, (_, i) => ({ name: `Vendor ${i}`, base: 50 + r() * 5000, cat: `Cat ${i % 25}` }))
  // A few very busy vendors, as real registers have (a courier, a card processor, payroll).
  for (let i = 0; i < 3; i++) vendors[i].base = 120
  for (let i = 0; i < rows; i++) {
    const v = i % 5 === 0 ? vendors[Math.floor(r() * 3)] : vendors[Math.floor(r() * vendors.length)]
    const day = Math.floor(r() * 365)
    const d = new Date(Date.UTC(2025, 9, 1) + day * 86_400_000).toISOString().slice(0, 10)
    txs.push({ id: `TX-${i}`, date: d, vendor: v.name, amount: Math.round(v.base * (0.5 + r()) * 100) / 100, description: `INV-${100000 + i}`, category: v.cat, account: '', rowIndex: i, direction: 'debit', period: '' })
  }
  return txs
}

if (require.main === module) {
  const n = Number(process.argv[2] ?? 60000)
  const txs = bigRegister(n)
  const t0 = Date.now()
  const f = runAnomalyDetection(txs)
  console.log(`${n} rows: ${f.length} findings in ${Date.now() - t0} ms`)
}
