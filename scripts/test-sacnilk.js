import axios from 'axios';

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
};

async function test() {
  const titles = ['Oppenheimer', 'Jawan', 'RRR', 'Avengers: Infinity War'];
  for (const title of titles) {
    const slug = title
      .replace(/[.:'"!@#%^&*()\-+=]/g, '')
      .replace(/\s+/g, '_');
    const url = `https://www.sacnilk.com/news/${slug}_Box_Office_Collection_Day_Wise_Worldwide`;
    try {
      const res = await axios.get(url, { headers: UA, timeout: 5000 });
      console.log(`URL: ${url} -> Status: ${res.status}`);
      // Print first 200 chars of body
      console.log(`  Body start: ${res.data.substring(0, 200)}`);
      
      const indiaNetMatch = res.data.match(/India Net Collection[^₹$]*₹\s*([\d,.]+)\s*Cr/i);
      console.log(`  indiaNetMatch:`, indiaNetMatch ? indiaNetMatch[0] : 'null');
    } catch (err) {
      console.log(`URL: ${url} -> Error: ${err.message}`);
    }
  }
}
test();
