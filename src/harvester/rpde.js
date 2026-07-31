// src/harvester/rpde.js
const fetch = require('node-fetch');

const REQUEST_DELAY_MS = 500;
const MAX_RETRIES      = 3;
const RETRY_DELAY_MS   = 5000;

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, timeout: 15000 });
      if (res.status === 429 || res.status === 503) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(RETRY_DELAY_MS);
    }
  }
}

async function harvestFeed({ feedUrl, startUrl, onItem, onProgress }) {
  let nextUrl = startUrl;
  let total   = 0;
  let pages   = 0;

  while (nextUrl) {
    const page = await fetchWithRetry(nextUrl);
    if (!page || !Array.isArray(page.items)) break;

    for (const item of page.items) await onItem(item);

    total += page.items.length;
    pages += 1;

    if (onProgress) onProgress({ total, pages, nextUrl: page.next });
    if (page.items.length === 0 && page.next === nextUrl) break;

    nextUrl = page.next || null;
    if (nextUrl) await sleep(REQUEST_DELAY_MS);
  }

  return { total, pages, nextUrl };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { harvestFeed };
