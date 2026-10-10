/** @type {import('tailwindcss').Config} */

// Every colour token resolves to a CSS variable declared in globals.css, so the
// palette lives in one place and opacity modifiers (bg-surface/90) still work.
const v = name => `rgb(var(--${name}) / <alpha-value>)`

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    borderRadius: {
      'none': '0',
      'sm':   '4px',
      DEFAULT: '6px',
      'md':   '6px',
      'lg':   '8px',
      'xl':   '10px',
      '2xl':  '14px',
      '3xl':  '20px',
      'full': '9999px',
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Ultramarine: actions, links, focus and selection only.
        accent: {
          50:  v('accent-50'),
          100: v('accent-100'),
          200: v('accent-200'),
          300: v('accent-300'),
          400: v('accent-400'),
          500: v('accent-500'),
          600: v('accent-600'),
          700: v('accent-700'),
          800: v('accent-800'),
          900: v('accent-900'),
          950: v('accent-950'),
        },
        sidebar: {
          bg:     v('sidebar-bg'),
          hover:  v('sidebar-hover'),
          active: v('sidebar-active'),
          border: v('sidebar-border'),
          text:   v('sidebar-text'),
          muted:  v('sidebar-muted'),
        },
        surface: {
          DEFAULT: v('surface'),
          raised:  v('surface-raised'),
          overlay: v('surface-overlay'),
          hover:   v('surface-hover'),
          sunken:  v('surface-sunken'),
        },
        border: {
          DEFAULT: v('border'),
          subtle:  v('border-subtle'),
          strong:  v('border-strong'),
        },
        text: {
          primary:   v('text-primary'),
          secondary: v('text-secondary'),
          muted:     v('text-muted'),
          inverse:   v('text-inverse'),
        },
        // The ultramarine field: the brand colour owning whole regions.
        field: {
          DEFAULT: v('field'),
          deep:    v('field-deep'),
          muted:   v('field-muted'),
        },
        // The one deep band on marketing pages, and the app's dark surfaces.
        ink: {
          DEFAULT: v('ink'),
          raised:  v('ink-raised'),
          line:    v('ink-line'),
          text:    v('ink-text'),
          muted:   v('ink-muted'),
        },
        // Finding severity and review outcome. Only findings wear these.
        critical: { DEFAULT: v('critical'), fg: v('critical-fg'), bg: v('critical-bg'), line: v('critical-line') },
        high:     { DEFAULT: v('high'),     fg: v('high-fg'),     bg: v('high-bg'),     line: v('high-line') },
        medium:   { DEFAULT: v('medium'),   fg: v('medium-fg'),   bg: v('medium-bg'),   line: v('medium-line') },
        low:      { DEFAULT: v('low'),      fg: v('low-fg'),      bg: v('low-bg'),      line: v('low-line') },
        positive: { DEFAULT: v('positive'), fg: v('positive-fg'), bg: v('positive-bg'), line: v('positive-line') },
      },
      fontSize: {
        'display': ['4rem',    { lineHeight: '1.03', letterSpacing: '-0.035em' }],
        'title':   ['2.5rem',  { lineHeight: '1.08', letterSpacing: '-0.03em' }],
        'heading': ['1.5rem',  { lineHeight: '1.2',  letterSpacing: '-0.02em' }],
      },
      boxShadow: {
        card:      '0 1px 2px 0 rgb(15 21 36 / 0.05)',
        'card-md': '0 4px 12px -2px rgb(15 21 36 / 0.08), 0 2px 4px -2px rgb(15 21 36 / 0.05)',
        frame:     '0 24px 48px -16px rgb(15 21 36 / 0.18), 0 8px 16px -8px rgb(15 21 36 / 0.08)',
        pop:       '0 12px 32px -8px rgb(15 21 36 / 0.22), 0 2px 6px -2px rgb(15 21 36 / 0.08)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      maxWidth: {
        page: '1200px',
      },
    },
  },
  plugins: [],
}
