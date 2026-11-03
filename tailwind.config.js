export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 主色 accent 族（index.tsx：#5B8DEF 系）。覆盖 blue-* 使布局主色全局生效；
        // JsonHighlight 的 key 与日志 TX tag 已用显式 hex 锁定，不受影响。
        blue: {
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
        primary: {
          DEFAULT: '#5B8DEF',
          hover: '#457CE0',
          light: '#77A3F6',
          lighter: '#93B6F8',
        },
      },
      fontFamily: {
        sans: ['Inter', '"Segoe UI"', '"Microsoft YaHei"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', 'Consolas', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}