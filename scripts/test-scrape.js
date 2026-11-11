import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('https://www.sacnilk.com/news/Box_Office_India_Daily_Collection', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000,
    });
    const html = res.data;
    const links = [...html.matchAll(/href="(\/news\/[^"]+Box_Office[^"]+)"/gi)].slice(0, 8);
    console.log('Links:', links.map(m => m[1]));
    const h3 = [...html.matchAll(/<h3[^>]*>([^<]{10,100})<\/h3>/gi)].slice(0, 10);
    console.log('H3:', h3.map(m => m[1].trim()));
    const netColl = [...html.matchAll(/India Net Collection[^₹]*₹\s*([\d,.]+)\s*Cr/gi)].slice(0, 5);
    console.log('Net:', netColl.map(m => m[1]));
  } catch (e) {
    console.error(e.message);
  }
}
test();
