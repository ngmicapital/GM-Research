#!/usr/bin/env node
// Fetch equity/macro quotes from Yahoo Finance v8 chart API and write data/ticker.json.
// Runs in GitHub Actions hourly (no CORS restriction server-side).

const fs = require('fs');
const path = require('path');
const https = require('https');

const SYMBOLS = [
  { key: 'spx',  yf: '^GSPC'     },
  { key: 'wti',  yf: 'CL=F'      },
  { key: 'gold', yf: 'GC=F'      },
  { key: 'vix',  yf: '^VIX'      },
  { key: 'dxy',  yf: 'DX-Y.NYB'  },
];

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; gm-research-ticker/1.0)' }
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' ' + body.slice(0, 200)));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function fetchOne(sym) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym.yf) + '?interval=1d&range=5d';
  const data = await get(url);
  const meta = data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
  if (!meta) throw new Error('No meta for ' + sym.yf);
  const price = meta.regularMarketPrice;
  const prev  = meta.chartPreviousClose;
  if (price == null || prev == null) throw new Error('Missing price/prev for ' + sym.yf);
  const pct = ((price - prev) / prev) * 100;
  return { key: sym.key, symbol: sym.yf, price, prev, pct };
}

(async () => {
  const out = { updated: new Date().toISOString(), quotes: {} };
  for (const s of SYMBOLS) {
    try {
      const q = await fetchOne(s);
      out.quotes[s.key] = { price: q.price, pct: q.pct };
      console.log(s.key, q.price, q.pct.toFixed(2) + '%');
    } catch (e) {
      console.error('FAIL', s.key, e.message);
    }
  }
  const outPath = path.join(__dirname, '..', 'data', 'ticker.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log('Wrote', outPath);
})().catch((e) => { console.error(e); process.exit(1); });
