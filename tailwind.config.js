/** Tailwind 3.4.17 build config. Classes are scanned from index.html and admin.html (incl. JS template strings). */
module.exports = {
  content: ['./web_live_build/index.html', './web_live_build/admin.html', './web_live_build/games.js', './web_live_build/hover-card.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Anton', 'Impact', 'Arial Narrow', 'sans-serif'],
        title: ['Barlow Condensed', 'Inter', 'sans-serif']
      }
    }
  },
  plugins: []
};
