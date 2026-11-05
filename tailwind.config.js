export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 桌面端强调色（#5B8DEF 系）。不覆盖 blue-*，避免影响手机端的单色主题。
        brand: {
          50: '#EAF1FD',
          100: '#D7E5FB',
          200: '#B9D2F9',
          300: '#93B6F8',
          400: '#77A3F6',
          500: '#5B8DEF',
          600: '#457CE0',
          700: '#3B6BC8',
          800: '#2E559F',
          900: '#233F77',
        },
      },
    },
  },
  plugins: [],
}
