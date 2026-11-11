import axios from 'axios';

async function testBH() {
  const res = await axios.get('https://www.bollywoodhungama.com/box-office/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 20000,
  });
  const html = res.data;
  // Try to find movie + collection pairs
  const pairs = [...html.matchAll(/>([^<]{3,60})<\/a>[\s\S]{0,200}?([\d,]+\.?\d*)\s*cr/gi)].slice(0, 15);
  console.log('Pairs:', pairs.map(m => ({ title: m[1].trim(), cr: m[2] })));
  const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (jsonLd) console.log('JSON-LD found, len:', jsonLd[1].length);
}
testBH().catch(e => console.error(e.message));
