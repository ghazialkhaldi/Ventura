// Shared chart styling for the light theme. Series colours were validated
// as a pair against the white chart surface (colour-vision separation and
// 3:1 contrast); anything past two series folds into "Other" or a table.
export const CHART = {
  series1: '#4f46c4',   // dawn indigo, one step off the action colour
  series2: '#d97757',   // dawn coral
  muted:   '#cbd2dc',   // border-strong: context bars that are not the point
  grid:    '#edf0f4',   // border-subtle
  axis:    '#636e82',   // text-muted
  tick:    { fontSize: 11, fill: '#636e82' },
  tooltip: {
    contentStyle: {
      fontSize: 12.5,
      background: '#ffffff',
      border: '1px solid #e2e6ec',
      borderRadius: 8,
      boxShadow: '0 12px 32px -8px rgb(15 21 36 / 0.22), 0 2px 6px -2px rgb(15 21 36 / 0.08)',
      color: '#0f1524',
      padding: '8px 10px',
    },
    labelStyle: { color: '#0f1524', fontWeight: 500, marginBottom: 2 },
    itemStyle:  { color: '#465062' },
    cursor:     { fill: 'rgba(15, 21, 36, 0.04)' },
  },
} as const
