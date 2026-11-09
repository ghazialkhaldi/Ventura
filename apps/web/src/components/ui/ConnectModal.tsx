import { useState, useEffect, useRef } from 'react'
import { Cross2Icon, UploadIcon, FileTextIcon, CheckCircledIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons'
import { parseFile } from '../../lib/transactionParser'
import { ingest } from '../../lib/ingest'

// Upload an export from any system. Systems with a live connection
// (QuickBooks, Xero, banks through Plaid, Gusto) connect from Integrations by
// signing in to them; nothing here ever asks for keys or passwords.

interface Props {
  integrationId: string                   // kept for callers; uploads are the only flow
  onClose: () => void
  onConnected: (id: string) => void
}

const ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,.xlsm,.xlsb,.pdf,.ofx,.qfx,.qbo'

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export default function ConnectModal({ integrationId, onClose, onConnected }: Props) {
  const [file,     setFile]     = useState<File | null>(null)
  const [step,     setStep]     = useState<'choose' | 'processing' | 'done'>('choose')
  const [status,   setStatus]   = useState('')
  const [error,    setError]    = useState('')
  const [result,   setResult]   = useState<{ txCount: number; anomalyCount: number; carried: number; name: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && step !== 'processing') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, step])

  function choose(f: File) {
    if (f.size > 50 * 1024 * 1024) { setError('That file is over 50 MB. Export a shorter date range and upload it in parts.'); return }
    setFile(f); setError('')
  }

  async function process() {
    if (!file) { setError('Choose a file first.'); return }
    setStep('processing'); setError('')
    try {
      setStatus('Reading the file…')
      const parsed = await parseFile(file)
      if ('error' in parsed) throw new Error(parsed.error)
      setStatus(`Checking ${parsed.transactions.length.toLocaleString()} transactions…`)
      await new Promise(r => setTimeout(r, 30)) // let the status paint before the checks run
      const r = ingest({
        sourceId: `upload:${file.name}`, label: file.name, transactions: parsed.transactions,
        file: { name: file.name, size: file.size, rowCount: parsed.rowCount }, mapping: parsed.mapping,
      })
      setResult({ ...r, name: file.name })
      setStep('done')
      onConnected(integrationId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The file could not be read.')
      setStep('choose')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={step === 'processing' ? undefined : onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-surface-raised shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <p id="upload-title" className="text-[15px] font-medium text-text-primary">Upload an export</p>
            <p className="text-[12.5px] text-text-muted">Payments, bills, a GL detail or a bank statement, from any system</p>
          </div>
          {step !== 'processing' && (
            <button onClick={onClose} aria-label="Close" className="rounded p-1 text-text-muted hover:text-text-secondary"><Cross2Icon className="h-4 w-4" /></button>
          )}
        </div>

        <div className="px-5 py-5">
          {step === 'choose' && (
            <>
              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-critical-line bg-critical-bg px-3.5 py-3 text-[13px] text-critical-fg">
                  <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" /> <span>{error}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) choose(f) }}
                className={`w-full rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${dragOver ? 'border-accent-500 bg-accent-50' : 'border-border-strong hover:border-accent-300'}`}
              >
                <input ref={input} type="file" className="hidden" accept={ACCEPT} onChange={e => { const f = e.target.files?.[0]; if (f) choose(f) }} />
                {file ? (
                  <span className="flex flex-col items-center gap-2">
                    <FileTextIcon className="h-6 w-6 text-accent-600" />
                    <span className="text-[14px] font-medium text-text-primary">{file.name}</span>
                    <span className="text-[12.5px] text-text-muted">{fmtBytes(file.size)} · choose another</span>
                  </span>
                ) : (
                  <span className="flex flex-col items-center gap-2">
                    <UploadIcon className="h-6 w-6 text-text-muted" />
                    <span className="text-[14px] font-medium text-text-secondary">Drop a file here, or choose one</span>
                    <span className="text-[12.5px] text-text-muted">CSV, Excel, PDF, or a bank download (OFX, QFX, QBO)</span>
                  </span>
                )}
              </button>
              <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted">
                Ventura finds the header row, maps the date, payee and amount columns, and sets refunds and credits aside.
              </p>
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={process} disabled={!file} className="h-10 flex-1 rounded-lg bg-accent-600 text-[14px] font-medium text-white hover:bg-accent-700 disabled:opacity-50">Check this file</button>
                <button type="button" onClick={onClose} className="h-10 rounded-lg border border-border-strong px-4 text-[14px] text-text-secondary hover:bg-surface-overlay">Cancel</button>
              </div>
            </>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-200 border-t-accent-600" />
              <p className="text-[14px] text-text-secondary">{status}</p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircledIcon className="h-8 w-8 text-positive-fg" />
              <p className="text-[15px] font-medium text-text-primary">{result.name} checked</p>
              <p className="text-[13.5px] text-text-muted">
                {result.txCount.toLocaleString()} transactions, {result.anomalyCount} finding{result.anomalyCount === 1 ? '' : 's'}
                {result.carried ? `, ${result.carried} earlier decisions kept` : ''}.
              </p>
              <div className="mt-4 flex gap-3">
                <a href="/anomalies" className="inline-flex h-10 items-center rounded-lg bg-accent-600 px-4 text-[14px] font-medium text-white hover:bg-accent-700">Review findings</a>
                <button type="button" onClick={onClose} className="h-10 rounded-lg border border-border-strong px-4 text-[14px] text-text-secondary hover:bg-surface-overlay">Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
