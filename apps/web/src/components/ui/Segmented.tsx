// One row of mutually exclusive views, each with its count. Replaces rows of
// same-size icon tiles: the counts are the filter, not decoration beside it.
export interface Segment<T extends string> { value: T; label: string; count?: number }

export default function Segmented<T extends string>({ segments, value, onChange, label }: {
  segments: Segment<T>[]
  value:    T
  onChange: (v: T) => void
  label:    string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-surface-overlay p-0.5 ring-1 ring-inset ring-border">
      {segments.map(s => {
        const on = s.value === value
        return (
          <button
            key={s.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(s.value)}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium ${
              on ? 'bg-surface-raised text-text-primary shadow-card' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {s.label}
            {s.count !== undefined && <span className={`tabular-nums ${on ? 'text-text-secondary' : 'text-text-muted'}`}>{s.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
