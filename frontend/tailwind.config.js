/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest:  { DEFAULT: '#1a5c3a', light: '#246b47' },
        mint:    '#3db87a',
        aqua:    '#00b4a0',
        navy:    { DEFAULT: '#0d1e35', 2: '#142943' },
        sky:     '#1e78d4',
        gold:    { DEFAULT: '#f5a623', dark: '#e8930d' },
        cream:   { DEFAULT: '#f4f7f2', 2: '#edf1e8' },
        muted:   '#5a7065',
        border:  '#dde8e1',
      },
      fontFamily: {
        sans:  ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      borderRadius: {
        xl:   '12px',
        '2xl':'16px',
        '3xl':'24px',
      },
      boxShadow: {
        card:   '0 4px 24px rgba(26,92,58,0.09)',
        'card-lg': '0 8px 32px rgba(13,31,60,0.14)',
        gold:   '0 6px 20px rgba(245,166,35,0.32)',
      },
      animation: {
        'fade-up':  'fadeUp 0.42s ease both',
        'fade-in':  'fadeIn 0.3s ease both',
        'slide-up': 'slideUp 0.3s ease both',
        'float':    'float 3s ease-in-out infinite',
        'pulse-dot':'pulse-dot 2s infinite',
        'spin-slow':'spin 1.2s linear infinite',
      },
      keyframes: {
        fadeUp:    { from:{ opacity:0, transform:'translateY(16px)' }, to:{ opacity:1, transform:'translateY(0)' } },
        fadeIn:    { from:{ opacity:0 }, to:{ opacity:1 } },
        slideUp:   { from:{ transform:'translateY(100%)' }, to:{ transform:'translateY(0)' } },
        float:     { '0%,100%':{ transform:'translateY(0)' }, '50%':{ transform:'translateY(-8px)' } },
        'pulse-dot':{ '0%,100%':{ opacity:1 }, '50%':{ opacity:.3 } },
      },
    },
  },
  plugins: [],
};
