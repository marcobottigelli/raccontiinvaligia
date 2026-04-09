/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    screens: {
      xs:  '380px',
      sm:  '640px',
      md:  '768px',
      lg:  '1024px',
      xl:  '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        brand: {
          50:  '#fdf2f2',
          100: '#fce4e4',
          200: '#f9c0c0',
          500: '#a90707',
          600: '#8a0606',
          700: '#6b0404',
          900: '#3d0202',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
