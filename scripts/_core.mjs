// The built-in catalogue (about 2,060 films and series) lives in web_live_build/catalog_core.js, NOT inside index.html:
//   window.__CORE_CATALOG=[ ... ];      (the array is plain JSON)
// index.html loads it with <script src="catalog_core.js?v=N"> just before the main script, so the browser keeps it cached for a year
// and the page itself stays small. Every data script reads and writes the catalogue through these two functions.
// writeCore() also raises N in index.html, so browsers fetch the new file after a change.
import fs from 'node:fs';
import path from 'node:path';

const PREFIX = 'window.__CORE_CATALOG=';

export function corePaths(root) {
  const web = path.join(root, 'web_live_build');
  return { web, file: path.join(web, 'catalog_core.js'), html: path.join(web, 'index.html') };
}

export function readCore(root) {
  const { file } = corePaths(root);
  const s = fs.readFileSync(file, 'utf8');
  if (!s.startsWith(PREFIX)) throw new Error('catalog_core.js has an unexpected start');
  return JSON.parse(s.slice(PREFIX.length).replace(/;\s*$/, ''));
}

export function writeCore(root, arr) {
  const { file, html } = corePaths(root);
  fs.writeFileSync(file, PREFIX + JSON.stringify(arr) + ';\n');
  let h = fs.readFileSync(html, 'utf8');
  const m = /catalog_core\.js\?v=(\d+)/.exec(h);
  if (m) { h = h.replace(m[0], 'catalog_core.js?v=' + (Number(m[1]) + 1)); fs.writeFileSync(html, h); }
  return arr.length;
}
