const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'main.js')
  ],
  theme: {
    extend: {
      colors: {
        kiosk: {
          bg: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        tv: '0 35px 120px rgba(15, 23, 42, 0.7)',
      },
    },
  },
  plugins: [],
};
