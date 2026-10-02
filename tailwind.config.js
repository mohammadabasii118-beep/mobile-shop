/** Design System — CaseLine */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0C0C0C',
        surface: '#141416',
        surface2: '#1B1B1F',
        line: 'rgba(215,226,234,0.10)',
        mist: '#D7E2EA',
        violet: { DEFAULT: '#8B5CF6' },
        magenta: '#EC4899',
        sky: { DEFAULT: '#38BDF8' },
        amber: { DEFAULT: '#FB923C' },
      },
      fontFamily: { sans: ['Vazirmatn', 'system-ui', 'sans-serif'] },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg,#8B5CF6 0%,#EC4899 55%,#FB923C 100%)',
      },
      boxShadow: { glow: '0 10px 60px -15px rgba(139,92,246,.55)' },
    },
  },
  plugins: [],
};
