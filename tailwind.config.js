/** Tailwind 3.4.17 build config. Classes are scanned from index.html and admin.html (incl. JS template strings). */
module.exports = {
  content: ['./web_live_build/index.html', './web_live_build/admin.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'Times New Roman', 'serif']
      }
    }
  },
  plugins: []
};
