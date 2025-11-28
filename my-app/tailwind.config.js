/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        verdeOscuro: "#012E24",
        verdeMedio: "#045C4C",
        verdeAqua: "#00C896",
      },
    },
  },
  plugins: [],
};
