import { PLATFORMS, findFlagged, fitTags, fitTitle } from "./rules.js";

// --- AI backends -----------------------------------------------------------
// Primary: NVIDIA Nemotron models on Nebius Token Factory (OpenAI-compatible).
//   VISION_MODEL  reads the uploaded design (multimodal).
//   TEXT_MODEL    writes the per-platform listings (reasoning).
// Fallback: Cloudflare Workers AI (keeps the free tool alive if no key set).
const TF_URL = "https://api.tokenfactory.nebius.com/v1/chat/completions";
const VISION_MODEL = "nvidia/Nemotron-3.5-Super-VL";
const TEXT_MODEL = "nvidia/nemotron-3-super-120b-a12b";
const CF_VISION = "@cf/meta/llama-4-scout-17b-16e-instruct";
const CF_TEXT = "@cf/mistralai/mistral-small-3.1-24b-instruct";

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function ipHash(req) {
  const ip = req.headers.get("cf-connecting-ip") || "x";
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + "pod-seo"));
  return [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toDataUrl(bytes) {
  let bin = ""; const u = Uint8Array.from(bytes);
  for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
  return "data:image/jpeg;base64," + btoa(bin);
}

async function nebiusChat(env, model, messages, maxTokens, temperature = 0.4, extra = {}, usageSink = null) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(TF_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.NEBIUS_API_KEY}` },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, ...extra }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`token factory ${r.status}`);
    const d = await r.json();
    if (usageSink && d.usage) usageSink.push(d.usage);
    return d.choices?.[0]?.message?.content || "";
  } finally { clearTimeout(t); }
}

// Prompt shape is load-bearing: long structured/OCR-style instructions make
// this VL model reason without terminating (measured: 2000-token budget
// fully consumed by reasoning, empty content, twice). This short
// conversational phrasing terminates reliably (measured 417-590 completion
// tokens, finish=stop, accurate incl. printed text). Do not lengthen it.
const VISION_PROMPT = (designText) =>
  "In 2-3 short sentences: garment type, main colors, key design features, and any text printed on the design." +
  (designText ? ` The seller says the exact text on the design is: "${designText}". Use that text.` : "");

async function describeDesign(env, image, designText, usageSink = null) {
  if (env.NEBIUS_API_KEY) {
    // VL budget: the Nemotron VL model's reasoning tokens count toward
    // max_tokens, and a long OCR-style prompt makes it reason without
    // terminating: measured 2000/2000 all-reasoning -> empty content (also
    // 120/120 at a tight budget). 2000 gives real headroom for this short
    // prompt shape.
    let out = null;
    try {
      out = await nebiusChat(env, VISION_MODEL, [{ role: "user", content: [
        { type: "text", text: VISION_PROMPT(designText) },
        { type: "image_url", image_url: { url: toDataUrl(image) } },
      ] }], 2000, 0.2, {}, usageSink);
    } catch (e) { out = null; /* transport/HTTP failure -> labeled fallback below */ }
    // FAIL CLOSED: empty content means the model spent its whole budget on
    // reasoning. Never swap engines silently - surface it as an error.
    if (out === "") throw new Error("vision model returned empty content (token budget exhausted by reasoning), please retry");
    if (out) return { desc: String(out).trim(), engine: "nebius", model: VISION_MODEL };
  }
  if (!env.AI) throw new Error("no vision backend");
  const r = await env.AI.run(CF_VISION, { messages: [{ role: "user", content: [
    { type: "text", text: VISION_PROMPT(designText) },
    { type: "image_url", image_url: { url: toDataUrl(image) } },
  ] }], max_tokens: 220 });
  const t = r.response || r.choices?.[0]?.message?.content || "";
  if (!t) throw new Error("vision fallback returned empty content");
  return { desc: String(t).trim(), engine: "cloudflare", model: CF_VISION };
}

// --- Image bounds for the spend guard --------------------------------------
// The browser resizes to <=640px, but direct API callers can bypass it, so the
// worker enforces a hard server-side dimension cap. Tokens for the VL model
// scale with image area; bounding dimensions (not just bytes) is what makes
// the worst-case cost derivable. Observed: 640px sheet -> 1538 image tokens;
// at 1024px worst-case scaling (~2.56x area) stays <= ~4000 tokens.
const MAX_IMG_SIDE = 1024;
function imageSize(bytes) {
  const u = Uint8Array.from(bytes);
  // PNG: 8-byte signature, IHDR width/height big-endian at 16/20
  if (u.length > 24 && u[0] === 0x89 && u[1] === 0x50) {
    const w = (u[16] << 24) | (u[17] << 16) | (u[18] << 8) | u[19];
    const h = (u[20] << 24) | (u[21] << 16) | (u[22] << 8) | u[23];
    return { w, h };
  }
  // JPEG: scan SOF0-SOF15 markers (except DHT/DAC/RST)
  if (u.length > 4 && u[0] === 0xff && u[1] === 0xd8) {
    let i = 2;
    while (i + 9 < u.length) {
      if (u[i] !== 0xff) { i++; continue; }
      const m = u[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        const h = (u[i + 5] << 8) | u[i + 6];
        const w = (u[i + 7] << 8) | u[i + 8];
        return { w, h };
      }
      const len = (u[i + 2] << 8) | u[i + 3];
      if (len < 2) return null;
      i += 2 + len;
    }
  }
  return null;
}

// --- Measured-cost budget (reserve worst case, settle actual) --------------
// Verified Token Factory rates (Oct 29, 2026 Prices page): $0.3 / 1M input,
// $0.9 / 1M output, both Nemotron models, excl. tax. In microdollars per
// token: 0.3 in, 0.9 out.
// estImageTokens: conservative upper bound for VL image tokens. Observed data
// point: a 133KB / <=640px design sheet billed 1538 multimodal tokens (usage
// field). No documented max tokenization was found, so the bound uses
// area/200 + 500 - >=1.6x the observed rate at 640px, ~3.7x a naive quadratic
// projection at the 1024px server cap. The reservation is still an estimate;
// the SETTLE step replaces it with measured usage after each call, so the
// lifetime accounting self-corrects every generation.
const MICRO_IN = 0.3, MICRO_OUT = 0.9;
function estImageTokens(w, h) { return Math.ceil((w * h) / 200) + 500; }
// Worst case per generation: VL in <= estImageTokens + ~150 prompt, out <=
// 2000 (max_tokens); writer in <= ~2600 (VL desc <= 2000 + template), out <=
// 2400 (max_tokens). Output budgets are hard API caps, not estimates.
function reserveMicro(dim) {
  const inTok = estImageTokens(dim.w, dim.h) + 150 + 2600;
  return Math.ceil(inTok * MICRO_IN + (2000 + 2400) * MICRO_OUT);
}
function actualMicro(usages) {
  let m = 0;
  for (const u of usages) m += (u.prompt_tokens || 0) * MICRO_IN + (u.completion_tokens || 0) * MICRO_OUT;
  return Math.ceil(m);
}

// --- Live trend grounding (Tavily) ----------------------------------------
async function tavilyTrends(env, desc, niche) {
  if (!env.TAVILY_API_KEY) return { trends: [], grounded: false };
  const subject = (niche || desc.split("\n")[0] || "").slice(0, 90);
  if (!subject) return { trends: [], grounded: false };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query: `trending print on demand keywords buyers search for "${subject}" t-shirt design Etsy Redbubble ${new Date().getFullYear()}`,
        max_results: 5,
        search_depth: "basic",
        include_answer: true,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) return { trends: [], grounded: false };
    const d = await r.json();
    const trends = [];
    const sources = [];
    if (d.answer) trends.push(String(d.answer).slice(0, 300));
    for (const it of d.results || []) {
      trends.push(`${it.title}: ${String(it.content || "").slice(0, 160)}`);
      if (it.url) sources.push({ title: String(it.title || "").slice(0, 120), url: String(it.url).slice(0, 300) });
    }
    return { trends: trends.slice(0, 5), grounded: trends.length > 0, sources: sources.slice(0, 5) };
  } catch { return { trends: [], grounded: false }; } finally { clearTimeout(t); }
}

function listingPrompt(desc, niche, keys, trends) {
  const rules = keys.map((k) => { const p = PLATFORMS[k]; return `${k}: title max ${p.titleMax} chars, give ${p.tagMax + 4} candidate tags (the best ones first), each max ${p.tagLen} chars, description max ${p.descMax} chars`; }).join("\n");
  const trendBlock = trends.length
    ? `\nLive web trend research (retrieved today):\n${trends.map((t, i) => `${i + 1}. ${t}`).join("\n")}\nWhere natural, prefer 2-4 phrases from this research for tags and title - only when they genuinely fit the design.`
    : "";
  return `You write SEO listings for print-on-demand sellers. Design description:\n${desc}\nSeller niche keyword: ${niche || "(none)"}${trendBlock}\nIMPORTANT: the design is ARTWORK printed on a blank garment chosen by the buyer. Describe the artwork and its style only; never state or imply physical garment construction (fabric, leather, pockets, zippers, stitching, fit) as product features - the design sheet depicts them, the printed product does not have them. Write one listing per platform. Rules:\n${rules}\nTitle: put the main buyer search phrase first, then product-neutral descriptors, audience, occasion. Tags: multi-word buyer search phrases, no repeats, no brand or trademark names, no filler. Description: 2-3 plain sentences about the artwork with the keywords, then a line about the gift occasion. Never invent claims about materials or sizes.\nReturn ONLY JSON: {"<platform>":{"title":"","tags":[""],"description":""}} for platforms: ${keys.join(", ")}.`;
}

function parseJson(txt) {
  const m = String(txt).match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no json");
  return JSON.parse(m[0]);
}

async function writeListings(env, desc, niche, keys, trends, usageSink = null) {
  const prompt = listingPrompt(desc, niche, keys, trends);
  if (env.NEBIUS_API_KEY) {
    // Reasoning tokens count toward max_tokens here too; 2400 keeps room for
    // the full 3-platform JSON after the model's reasoning.
    let out = null;
    try {
      // The writer model honors reasoning_effort:"low" (the VL model ignores
      // it - measured). Without it, the long rules prompt makes the writer
      // reason without terminating: measured 2400/2400 all-reasoning, empty
      // content. With it: ~300 reasoning, full JSON, finish=stop.
      out = await nebiusChat(env, TEXT_MODEL, [{ role: "user", content: prompt }], 2400, 0.4, { reasoning_effort: "low" }, usageSink);
    } catch (e) { out = null; /* transport/HTTP failure -> labeled fallback below */ }
    // FAIL CLOSED: empty or unparseable (truncated) output means the token
    // budget was exhausted - surface it, never swap engines silently.
    if (out === "") throw new Error("writer model returned empty content (token budget exhausted by reasoning), please retry");
    if (out) return { data: parseJson(out), engine: "nebius", model: TEXT_MODEL };
  }
  if (!env.AI) throw new Error("no text backend");
  const r = await env.AI.run(CF_TEXT, { messages: [{ role: "user", content: prompt }], max_tokens: 1400, temperature: 0.4 });
  const raw = r.choices?.[0]?.message?.content || (typeof r.response === "string" ? r.response : JSON.stringify(r.response));
  return { data: parseJson(raw), engine: "cloudflare", model: CF_TEXT };
}

export async function generate(env, image, niche, keys, designText, allowTavily, usageSink = null) {
  const v = await describeDesign(env, image, designText, usageSink);
  let trends = [], grounded = false, sources = [], groundingNote;
  if (allowTavily === false) {
    groundingNote = "live trend search is disabled for this demo";
  } else if (allowTavily === "quota") {
    groundingNote = "free live-trend quota reached";
  } else if (!env.TAVILY_API_KEY) {
    groundingNote = "trend search not configured";
  } else {
    const r = await tavilyTrends(env, v.desc, niche);
    trends = r.trends; grounded = r.grounded; sources = r.sources || [];
    if (!grounded) groundingNote = "trend search unavailable";
  }
  const w = await writeListings(env, v.desc, niche, keys, trends, usageSink);
  const out = {};
  for (const k of keys) {
    const p = PLATFORMS[k]; const d = w.data[k] || {};
    const title = fitTitle(d.title, p);
    const tags = fitTags(d.tags, p);
    const description = String(d.description || "").slice(0, p.descMax);
    out[k] = { title, tags, description, flagged: findFlagged([title, tags.join(" "), description].join(" ")) };
    if (k === "teepublic") out[k].mainTag = tags[0] || "";
  }
  return { designSummary: v.desc, listings: out, meta: { vision: { backend: v.engine, model: v.model }, writer: { backend: w.engine, model: w.model }, grounded, groundingNote: grounded ? undefined : groundingNote, trends: grounded ? trends : [], sources: grounded ? sources : [] } };
}


// --- Spend budget (Durable Object, SQLite-backed) ---------------------------
// One global instance ("global") serializes ALL budget decisions, so the
// counters are concurrency-safe. A single atomic transaction checks and
// increments BOTH the global daily demo budget and the per-IP daily budget
// BEFORE any paid backend call (Nebius, Tavily, or Workers AI fallback).
// If the budget check itself fails, the request is denied (fail closed).
export class Budget {
  constructor(state) {
    this.state = state;
    this.sql = state.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS spend (scope TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)");
  }
  async fetch(req) {
    let b;
    try { b = await req.json(); } catch { return Response.json({ ok: false, reason: "bad-request" }, { status: 400 }); }
    const path = new URL(req.url).pathname;
    if (path === "/settle") {
      // Replace a reservation with the measured cost from the API usage
      // fields. Never called on failure paths, so an abandoned reservation
      // stays spent (conservative).
      const delta = (Math.max(0, b.actualMicro | 0)) - (Math.max(0, b.reserveMicro | 0));
      this.sql.exec("INSERT INTO spend (scope, n) VALUES ('c:all', 0) ON CONFLICT(scope) DO NOTHING");
      this.sql.exec("UPDATE spend SET n = MAX(0, n + ?) WHERE scope = 'c:all'", delta);
      return Response.json({ ok: true });
    }
    const day = new Date().toISOString().slice(0, 10);
    const g = "g:" + day;
    const p = "p:" + day + ":" + String(b.ip || "x");
    const t = "t:lifetime";
    const l = "l:all";
    const c = "c:all"; // lifetime measured-cost ledger, microdollars
    const gLim = Math.max(1, b.globalLimit | 0), pLim = Math.max(1, b.ipLimit | 0);
    const tLim = Math.max(0, b.tavilyLimit | 0); // lifetime Tavily call cap; 0 = Tavily disabled
    const lLim = Math.max(0, b.lifetimeLimit | 0); // lifetime generation cap; 0 = block all (fail closed)
    const cLim = Math.max(0, b.lifetimeCostBudget | 0); // lifetime cost budget in microdollars; 0 = block all (fail closed)
    const reserve = Math.max(0, b.reserveMicro | 0); // worst-case cost to reserve for THIS generation
    let out;
    this.state.storage.transactionSync(() => {
      const gn = (this.sql.exec("SELECT n FROM spend WHERE scope = ?", g).toArray()[0] || {}).n || 0;
      const pn = (this.sql.exec("SELECT n FROM spend WHERE scope = ?", p).toArray()[0] || {}).n || 0;
      const tn = (this.sql.exec("SELECT n FROM spend WHERE scope = ?", t).toArray()[0] || {}).n || 0;
      const ln = (this.sql.exec("SELECT n FROM spend WHERE scope = ?", l).toArray()[0] || {}).n || 0;
      if (gn >= gLim) { out = { ok: false, reason: "global-budget" }; return; }
      if (pn >= pLim) { out = { ok: false, reason: "ip-limit" }; return; }
      if (ln >= lLim) { out = { ok: false, reason: "lifetime-budget" }; return; }
      const cn = (this.sql.exec("SELECT n FROM spend WHERE scope = ?", c).toArray()[0] || {}).n || 0;
      if (cn + reserve > cLim) { out = { ok: false, reason: "lifetime-budget" }; return; }
      this.sql.exec("INSERT INTO spend (scope, n) VALUES (?, 1) ON CONFLICT(scope) DO UPDATE SET n = n + 1", g);
      this.sql.exec("INSERT INTO spend (scope, n) VALUES (?, 1) ON CONFLICT(scope) DO UPDATE SET n = n + 1", p);
      this.sql.exec("INSERT INTO spend (scope, n) VALUES (?, 1) ON CONFLICT(scope) DO UPDATE SET n = n + 1", l);
      this.sql.exec("INSERT INTO spend (scope, n) VALUES (?, ?) ON CONFLICT(scope) DO UPDATE SET n = n + ?", c, reserve, reserve);
      const tavilyOk = tn < tLim;
      if (tavilyOk) {
        this.sql.exec("INSERT INTO spend (scope, n) VALUES (?, 1) ON CONFLICT(scope) DO UPDATE SET n = n + 1", t);
      }
      out = { ok: true, remaining: pLim - pn - 1, globalRemaining: gLim - gn - 1, tavilyOk, tavilyDisabled: tLim === 0, tavilyRemaining: Math.max(0, tLim - tn - (tavilyOk ? 1 : 0)) };
    });
    return Response.json(out);
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/api/generate" && req.method === "POST") {
      let body;
      try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
      const keys = (body.platforms || ["etsy", "redbubble", "teepublic"]).filter((k) => PLATFORMS[k]);
      const image = Array.isArray(body.image) ? body.image : null;
      // Input bound for the spend guard: the UI resizes to <=640px (well under
      // 200KB); direct API callers are held to the same envelope so the VL
      // input tokens - and therefore worst-case cost per generation - stay
      // strictly bounded.
      if (!image || !keys.length || image.length > 200000) return json({ error: "send a resized image (bytes array, max 200000 bytes) and at least one platform" }, 400);
      const dim = imageSize(image);
      if (!dim) return json({ error: "image must be JPEG or PNG" }, 400);
      if (Math.max(dim.w, dim.h) > MAX_IMG_SIDE) return json({ error: `image too large: max ${MAX_IMG_SIDE}px on the long side (the uploader resizes automatically)` }, 400);
      const reserve = reserveMicro(dim);
      let spend;
      try {
        spend = await env.BUDGET.getByName("global").fetch("https://budget/spend", {
          method: "POST",
          body: JSON.stringify({ ip: await ipHash(req), globalLimit: parseInt(env.GLOBAL_PER_DAY || "100", 10), ipLimit: parseInt(env.FREE_PER_DAY || "5", 10), tavilyLimit: parseInt(env.TAVILY_LIFETIME_MAX || "0", 10), lifetimeLimit: parseInt(env.NEBIUS_LIFETIME_MAX || "500", 10), lifetimeCostBudget: Math.round(parseFloat(env.NEBIUS_LIFETIME_COST_USD || "8") * 1e6), reserveMicro: reserve }),
        }).then((r) => r.json());
      } catch {
        return json({ error: "budget check unavailable, try again later" }, 503); // fail closed
      }
      if (!spend.ok) {
        return json({ error: spend.reason === "lifetime-budget" ? "demo lifetime budget reached" : spend.reason === "global-budget" ? "demo budget reached for today, try again tomorrow" : "free limit reached for today" }, 429);
      }
      const usages = [];
      try {
        const res = await generate(env, image, String(body.niche || "").slice(0, 80), keys, String(body.designText || "").slice(0, 100), spend.tavilyOk ? true : (spend.tavilyDisabled ? false : "quota"), usages);
        // Settle the reservation to the measured cost from the API usage
        // fields. Best-effort: if settle fails the reservation stays spent,
        // which is the conservative direction. Failures before this point
        // keep the full reservation for the same reason.
        try {
          await env.BUDGET.getByName("global").fetch("https://budget/settle", {
            method: "POST",
            body: JSON.stringify({ actualMicro: actualMicro(usages), reserveMicro: reserve }),
          });
        } catch { /* reservation stays spent - conservative */ }
        return json({ ...res, remaining: spend.remaining, globalRemaining: spend.globalRemaining });
      } catch (e) {
        return json({ error: "generation failed, try again", detail: String(e.message || e).slice(0, 120) }, 502);
      }
    }
    return env.ASSETS.fetch(req);
  },
};
