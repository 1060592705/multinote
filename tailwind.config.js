/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        accent: '#A78BFA',
        'accent-hover': '#8B6FDF',
        'accent-light': '#EDE9FE',
        paper: '#FEFEF8',
        'paper-dark': '#1A1A1A',
      },
      width: {
        'page': '720px',
        'sidebar': '280px',
        'sidebar-collapsed': '48px',
      },
      spacing: {
        'gap': '24px',
        'page-px': '40px',
        'page-py': '48px',
      },
      animation: {
        'page-slide': 'pageSlide 0.3s ease-out',
        'brush-bounce': 'brushBounce 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        pageSlide: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        brushBounce: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
