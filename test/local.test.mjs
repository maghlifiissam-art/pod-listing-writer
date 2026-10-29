import workerDefault, { generate, Budget } from '../src/worker.js';

class FakeSql {
  constructor() { this.m = new Map(); }
  exec(q, ...p) {
    if (q.startsWith('CREATE')) return { toArray: () => [] };
    if (q.startsWith('SELECT')) { const n = this.m.get(p[0]) || 0; return { toArray: () => n ? [{ n }] : [] }; }
    if (q.startsWith('INSERT')) { const inc = p.length >= 3 ? Number(p[1]) : (p.length === 2 ? Number(p[1]) : 1); this.m.set(p[0], (this.m.get(p[0]) || 0) + inc); return { toArray: () => [] }; }
    if (q.startsWith('UPDATE')) { this.m.set('c:all', Math.max(0, (this.m.get('c:all') || 0) + Number(p[0]))); return { toArray: () => [] }; }
    throw new Error('unexpected sql: ' + q);
  }
}
class FakeState { constructor() { this.storage = { sql: new FakeSql(), transactionSync: (f) => f() }; } }
const spendReq = (over = {}) => new Request('https://budget/spend', { method: 'POST', body: JSON.stringify({ ip: '1.2.3.4', globalLimit: 100, ipLimit: 5, tavilyLimit: 0, lifetimeLimit: 2, lifetimeCostBudget: 8000000, reserveMicro: 1000, ...over }) });

const img = [1,2,3];
let fetchCalls = [];
function stubFetch(handler) {
  fetchCalls = [];
  globalThis.fetch = async (url, opts) => {
    fetchCalls.push({ url, body: JSON.parse(opts.body) });
    return handler(url, opts);
  };
}
const okJson = (content) => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) });
const envBase = { NEBIUS_API_KEY: 'x' }; // no TAVILY key -> grounding skipped
const envWithAI = { ...envBase, AI: { run: async (model, o) => model.includes('llama') ? { response: 'cf vision desc' } : { response: '{"etsy":{"title":"t","tags":["a"],"description":"d"}}' } } };

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name); } };

// 1. VL empty content -> fail closed even when Workers AI fallback exists
stubFetch(() => okJson(''));
let threw = null;
try { await generate(envWithAI, img, '', ['etsy'], '', false); } catch (e) { threw = e; }
check('VL empty content fails closed (no silent fallback)', threw && /empty content/.test(threw.message));

// 2. VL HTTP 500 -> labeled fallback to Workers AI
stubFetch(() => ({ ok: false, status: 500, json: async () => ({}) }));
const r2 = await generate(envWithAI, img, '', ['etsy'], '', false);
check('VL HTTP 500 falls back with cloudflare label', r2.meta.vision.backend === 'cloudflare');

// 3. Writer empty content -> fail closed
let n = 0;
stubFetch(() => { n++; return okJson(n === 1 ? 'vision desc' : ''); });
threw = null;
try { await generate(envBase, img, '', ['etsy'], '', false); } catch (e) { threw = e; }
check('writer empty content fails closed', threw && /writer model returned empty content/.test(threw.message));

// 4. Happy path: budgets 800/2400 sent, nebius engines labeled
stubFetch((u, o) => okJson(o.body.includes('image_url') ? 'nice hoodie desc' : '{"etsy":{"title":"Bordeaux Hoodie","tags":["bordeaux hoodie"],"description":"A hoodie."}}'));
const r4 = await generate(envBase, img, '', ['etsy'], '', true);
const isVl = (c) => Array.isArray(c.body.messages[0].content) && c.body.messages[0].content.some(p => p.type === 'image_url');
const vlCall = fetchCalls.find(isVl);
const wrCall = fetchCalls.find(c => !isVl(c));
check('VL called with max_tokens 2000', vlCall && vlCall.body.max_tokens === 2000);
check('writer called with max_tokens 2400', wrCall && wrCall.body.max_tokens === 2400);
check('happy path engines both nebius', r4.meta.vision.backend === 'nebius' && r4.meta.writer.backend === 'nebius');
check('no tavily key -> grounded false + note', r4.meta.grounded === false && r4.meta.groundingNote === 'trend search not configured');

// 8-10. Budget DO: lifetime cap enforced atomically, fail closed at 0
{
  const b = new Budget(new FakeState());
  const r1 = await (await b.fetch(spendReq())).json();
  const r2 = await (await b.fetch(spendReq())).json();
  const r3 = await (await b.fetch(spendReq())).json();
  check('lifetime cap: first two allowed', r1.ok === true && r2.ok === true);
  check('lifetime cap: third blocked with lifetime-budget', r3.ok === false && r3.reason === 'lifetime-budget');
  const b0 = new Budget(new FakeState());
  const r0 = await (await b0.fetch(spendReq({ lifetimeLimit: 0 }))).json();
  check('lifetimeLimit 0 blocks everything (fail closed)', r0.ok === false && r0.reason === 'lifetime-budget');
}

// 11-14. Server-side image dimension guard (browser resize is bypassable)
{
  const png = (w, h) => [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a, 0,0,0,0x0d, 0x49,0x48,0x44,0x52, (w>>24)&255,(w>>16)&255,(w>>8)&255,w&255, (h>>24)&255,(h>>16)&255,(h>>8)&255,h&255, 8,6,0,0,0];
  const jpeg = (w, h) => [0xff,0xd8, 0xff,0xe0,0,0x10, ...Array(14).fill(0), 0xff,0xc0,0,0x11, 8, (h>>8)&255,h&255, (w>>8)&255,w&255, 3, ...Array(20).fill(0)];
  const envStub = { BUDGET: { getByName: () => ({ fetch: async () => Response.json({ ok: true, remaining: 4, tavilyOk: false, tavilyDisabled: true }) }) }, ASSETS: { fetch: () => new Response('asset') } };
  const post = (image) => workerDefault.fetch(new Request('https://x/api/generate', { method: 'POST', body: JSON.stringify({ image, platforms: ['etsy'] }) }), envStub);
  const bigPng = await (await post(png(3000, 100))).json();
  check('oversize PNG rejected server-side', /max 1024px/.test(bigPng.error || ''));
  const bigJpg = await (await post(jpeg(100, 5000))).json();
  check('oversize JPEG rejected server-side', /max 1024px/.test(bigJpg.error || ''));
  const notImg = await (await post([1,2,3,4,5])).json();
  check('non-JPEG/PNG rejected', /JPEG or PNG/.test(notImg.error || ''));
}

// 15. Writer prompt carries the artwork-vs-product guard
{
  const src = await (await import('fs')).readFileSync(new URL('./worker.mjs', import.meta.url), 'utf8');
  check('writer prompt guards artwork vs physical product', /ARTWORK printed on a blank garment/.test(src) && /never state or imply physical garment construction/.test(src));
}

// 16-17. Grounding note tri-state
{
  const twoStage = (u, o) => okJson(o.body.includes('image_url') ? 'vision desc' : '{"etsy":{"title":"T","tags":["a"],"description":"d"}}');
  stubFetch(twoStage);
  const rA = await generate(envBase, img, '', ['etsy'], '', false);
  check('disabled note when tavily disabled', rA.meta.groundingNote === 'live trend search is disabled for this demo');
  stubFetch(twoStage);
  const rB = await generate(envBase, img, '', ['etsy'], '', 'quota');
  check('quota note only on real quota exhaustion', rB.meta.groundingNote === 'free live-trend quota reached');
}

// 18-20. Measured-cost budget: reserve blocks, settle frees
{
  const st = new FakeState();
  const b = new Budget(st);
  // budget allows exactly 3000 microdollars; each generation reserves 2000
  const r1 = await (await b.fetch(spendReq({ lifetimeCostBudget: 3000, reserveMicro: 2000 }))).json();
  check('first reservation within cost budget allowed', r1.ok === true);
  const r2 = await (await b.fetch(spendReq({ lifetimeCostBudget: 3000, reserveMicro: 2000 }))).json();
  check('second reservation exceeding cost budget blocked', r2.ok === false && r2.reason === 'lifetime-budget');
  // settle the first reservation down to its measured 500 microdollars
  const stl = await (await b.fetch(new Request('https://budget/settle', { method: 'POST', body: JSON.stringify({ actualMicro: 500, reserveMicro: 2000 }) }))).json();
  check('settle adjusts reservation to measured actual', stl.ok === true);
  const r3 = await (await b.fetch(spendReq({ lifetimeCostBudget: 3000, reserveMicro: 2000 }))).json();
  check('after settle, budget has room again', r3.ok === true);
}

// 21. Spend response carries shared daily total
{
  const st = new FakeState();
  const b = new Budget(st);
  const r = await (await b.fetch(spendReq())).json();
  check('spend response exposes globalRemaining', r.ok && typeof r.globalRemaining === 'number');
}

// 22. Cost budget 0 fails closed
{
  const st = new FakeState();
  const b = new Budget(st);
  const r = await (await b.fetch(spendReq({ lifetimeCostBudget: 0 }))).json();
  check('lifetimeCostBudget 0 blocks everything (fail closed)', r.ok === false && r.reason === 'lifetime-budget');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
