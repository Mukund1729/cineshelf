import axios from 'axios';

async function test() {
  const url = 'https://www.sacnilk.com/news/Spider_Man_Brand_New_Day_2026_Box_Office_Collection_Day_Wise_Worldwide';
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 20000,
  });
  const html = res.data;
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  console.log('Title:', titleMatch?.[1]);
  const worldwide = html.match(/Worldwide Collection[^₹]*₹\s*([\d,.]+)\s*Cr/i);
  const indiaNet = html.match(/India Net Collection[^₹]*₹\s*([\d,.]+)\s*Cr/i);
  const indiaGross = html.match(/India Gross Collection[^₹]*₹\s*([\d,.]+)\s*Cr/i);
  console.log({ worldwide: worldwide?.[1], indiaNet: indiaNet?.[1], indiaGross: indiaGross?.[1] });
  const dayRows = [...html.matchAll(/Day\s*(\d+)[^₹]*₹\s*([\d,.]+)\s*Cr/gi)].slice(0, 5);
  console.log('Days:', dayRows.map(m => ({ day: m[1], cr: m[2] })));
}
test().catch(e => console.error(e.message));
