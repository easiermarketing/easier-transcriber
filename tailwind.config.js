/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyan: '#6EF6FF',
        purple: '#6E46FF',
        green: '#46FF88',
        blue: '#0694FF',
        darkBg: '#121417',
        darkGrey: '#202224',
        lightBg: '#FFFFFF',
        lightGrey: '#F5F5F7',
        textLight: '#FFFFFF',
        textDark: '#121417',
        yellow: '#FFC74C',
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        caveat: ['Caveat', 'cursive'],
      },
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['18px', '28px'],
        xl: ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['30px', '36px'],
        '4xl': ['36px', '40px'],
      },
      borderRadius: {
        full: '9999px',
        lg: '12px',
        md: '8px',
        sm: '4px',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
      },
    },
  },
  plugins: [],
}
