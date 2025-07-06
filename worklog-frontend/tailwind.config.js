/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}" // This line tells Tailwind to scan your React components
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        pastelYellow: '#FFFACD',
        pastelGreen: '#C1E1C1',
        pastelPink: '#FFD1DC',
        pastelBlue: '#ADD8E6',
      },
    },
  },
  plugins: [],
};
