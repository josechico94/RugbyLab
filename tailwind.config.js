/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#E8F5EE',
          100: '#C5E3D1',
          200: '#8EC9A8',
          400: '#2D9B5F',
          600: '#1B6B3A',
          800: '#0D3D22',
          900: '#0A2218',
        },
        gold: {
          400: '#F5A623',
          600: '#B87400',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
