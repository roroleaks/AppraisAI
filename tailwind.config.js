/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        aimed: {
          teal: '#0f6b6b',
          'teal-dark': '#0a4a4a',
          'teal-light': '#e3f2f2',
          'teal-border': '#99f6e4',
          bg: '#f6f8fa',
          ink: '#1a2332',
          muted: '#5a6a7e',
          border: '#d8dee6',
        },
        brand: {
          50: '#e3f2f2',
          100: '#cceded',
          200: '#99f6e4',
          500: '#0f6b6b',
          600: '#0b5555',
          700: '#0f6b6b',
          800: '#0a4a4a',
          900: '#073333',
        },
        academic: {
          navy: '#0f172a',
          slate: '#334155',
          parchment: '#f8fafc',
          crimson: '#991b1b',
          emerald: '#065f46',
          amber: '#b45309',
        }
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
