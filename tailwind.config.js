/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        zinc: {
          950: '#09090b',
        },
      },
    },
  },
  plugins: [],
}
