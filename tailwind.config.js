/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/app.js'],
  theme: {
    extend: {
      colors: {
        obsidian: '#090A0C',
        panel: '#14161D',
        panel2: '#1B1E26',
        edge: '#2E3340',
        accent: '#FFDC00',
        danger: '#FF334B',
        ok: '#00E676',
        info: '#00E5FF'
      },
      fontFamily: {
        display: ['Montserrat', 'Chakra Petch', 'sans-serif'],
        ui: ['Chakra Petch', 'Inter', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Share Tech Mono', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
};
