/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    borderRadius: {
      'none': '0',
      'sm':   '0',
      DEFAULT: '0',
      'md':   '0',
      'lg':   '0',
      'xl':   '0',
      '2xl':  '0',
      '3xl':  '0',
      'full': '9999px',
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Steel-blue accent — replaces the previous emerald `brand` scale.
        // Deliberately desaturated: this is the single biggest lever for
        // reading as enterprise infrastructure (IBM/Intel) rather than a
        // bright-green "AI startup" product.
        accent: {
          50:  '#eef4fb',
          100: '#d9e6f6',
          200: '#aec9ea',
          300: '#7ea9dc',
          400: '#4f88cb',
          500: '#3574b8',
          600: '#285d97',
          700: '#204a79',
          800: '#1a3b60',
          900: '#152f4d',
          950: '#0d1e33',
        },
        sidebar: {
          bg:     '#0c1526',
          hover:  '#162036',
          active: '#1a2d44',
          border: '#1e2d47',
          text:   '#8ea4c0',
          muted:  '#4d6a8a',
        },
        // Semantic surface/border/text tokens for the site-wide dark theme.
        // surface.DEFAULT intentionally matches sidebar.bg's family so the
        // sidebar stops reading as a separate dark island.
        surface: {
          DEFAULT: '#0b1220',
          raised:  '#111a2c',
          overlay: '#182338',
          hover:   '#1c2840',
          sunken:  '#070c16',
        },
        border: {
          DEFAULT: '#22304a',
          subtle:  '#182338',
          strong:  '#31456b',
        },
        text: {
          primary:   '#e8edf5',
          secondary: '#a9b8cf',
          muted:     '#7186a3',
          inverse:   '#0b1220',
        },
      },
      boxShadow: {
        card:    '0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.04)',
        'card-md': '0 4px 6px -1px rgba(0,0,0,.07), 0 2px 4px -2px rgba(0,0,0,.05)',
      },
    },
  },
  plugins: [],
}
