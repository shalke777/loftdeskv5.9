export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: { 900: '#0E3D20', 800: '#1A5C32', 700: '#236B3A', 600: '#2E8048', DEFAULT: '#1A5C32' },
        sand: { 50: '#FDFAF5', 100: '#F5F0E8', 200: '#EDE8DD', 300: '#DDD6C9', 400: '#C4BAA8' },
        rust: { DEFAULT: '#B8742A', light: '#D4944A', dark: '#8F5A1F' },
        ink: { DEFAULT: '#1a1a1a', 60: '#666666', 40: '#999999', 20: '#CCCCCC' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 12px rgba(0,0,0,0.06)',
        card: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)',
        panel: '0 8px 40px rgba(0,0,0,0.10)',
        green: '0 8px 32px rgba(26,92,50,0.20)',
      },
    },
  },
  plugins: [],
}
