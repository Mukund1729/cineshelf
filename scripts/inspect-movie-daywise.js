import axios from 'axios';
import fs from 'fs';

const url = 'https://indian-boxoffice.com/movies/ramayana_part_1_2026/';
const html = (await axios.get(url, {
  timeout: 20000,
  headers: { 'User-Agent': 'Mozilla/5.0' },
})).data;
fs.writeFileSync('scripts/_movie.html', html);

const table = (html.match(/<table[\s\S]*?<\/table>/i) || [])[0] || '';
console.log('table len', table.length);
console.log(table.slice(0, 2500));
const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
console.log('rows', rows.length);
console.log('row1', rows[1]?.[0]?.replace(/\s+/g, ' ').slice(0, 500));
console.log('row2', rows[2]?.[0]?.replace(/\s+/g, ' ').slice(0, 500));
console.log('row-last', rows.at(-1)?.[0]?.replace(/\s+/g, ' ').slice(0, 500));
