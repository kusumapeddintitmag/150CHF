/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effaf7',
          100: '#d8f5ec',
          500: '#10b981',
          600: '#0d8f6d',
          700: '#0b6d59'
        }
      }
    }
  },
  plugins: []
};
