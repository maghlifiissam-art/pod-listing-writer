# POD Listing Writer

Upload a t-shirt design, get an SEO-ready title, tags and description sized to each
print-on-demand marketplace's exact rules - Etsy, Redbubble and TeePublic - with
trademark flags and live trend grounding.

Demo: https://pod-seo-tool.magpro369.workers.dev (currently serves the
pre-hackathon Workers AI build; the Nemotron re-engine deploys when Token
Factory access lands)

**Status:** the Nemotron/Tavily pipeline is code-complete and verified offline
with mock-backed tests (budget gate, rule enforcement, fallback labeling).
Live Token Factory and Tavily calls are pending account access; every
live-dependent claim in the submission materials is re-checked against real
runs before submitting.

## Why it exists

POD sellers lose sales to weak listings: wrong tag counts, truncated titles, generic
keywords, and accidental trademark terms that get listings removed. Existing SEO tools
charge $5-30/month. This tool is free (5 designs/day, no signup) and writes listings
that fit each platform's real limits.

## How it works

1. **Design understanding (vision).** The uploaded design is analyzed by a
   vision-language model (**NVIDIA Nemotron 3.5 Super VL**) served on **Nebius
   Token Factory** - it reads the artwork, quotes any text on it exactly, and
   infers the likely audience.
2. **Live trend grounding, honestly capped.** While its verified free quota
   lasts, **Tavily** search retrieves today's real buyer-search trends for the
   design's subject, so tags and titles follow what shoppers actually type this
   week instead of stale model memory. A lifetime cap in the budget Durable
   Object enforces the quota; when it is spent, generations continue ungrounded
   and the results page says so - nothing ever bills.
3. **Listing writing (reasoning).** **NVIDIA Nemotron-3-Super-120B-A12B** on Token
   Factory writes one listing per platform, grounded in the trend research
   when grounding is active.
4. **Rule enforcement.** `src/rules.js` hard-enforces each platform's limits
   (Etsy: 13 tags x 20 chars, title 140; Redbubble: 15 x 50, title 60; TeePublic:
   up to 15 tags, one designated main tag weighted heavily in search) and flags ~50 commonly protected brand terms.

Model routing follows the Token Factory pattern: Nemotron 3.5 Super VL handles
the fast image pass, and the larger Nemotron 3 Super 120B handles the one
reasoning-heavy listing pass - the whole AI pipeline stays in the NVIDIA Nemotron
family, and each generation stays quick and credit-cheap.

## Stack

- Frontend + API: Cloudflare Workers (static assets + `/api/generate`)
- AI: Nebius Token Factory, OpenAI-compatible endpoint
  (`https://api.tokenfactory.nebius.com/v1/chat/completions`)
- Trend grounding: Tavily Search API
- Spend control: a Cloudflare Durable Object (SQLite-backed, one global instance) atomically enforces 5 free generations/day per IP hash, a global daily demo budget, and a lifetime Tavily grounding cap - all before any backend call, failing closed on error
- Resilience: if no `NEBIUS_API_KEY` is configured, the worker falls back to
  Cloudflare Workers AI so the free tier stays alive.

## Run it yourself

Requirements: a Cloudflare account (free) and Node.js 18+.

```bash
npm install -g wrangler
wrangler login
# the Budget Durable Object and its SQLite migration are already declared in
# wrangler.toml - no KV namespace to create
# AI keys
wrangler secret put NEBIUS_API_KEY   # from https://tokenfactory.nebius.com
wrangler secret put TAVILY_API_KEY   # from https://tavily.com
# deploy
wrangler deploy
```

Then open the workers.dev URL, upload a design image, pick platforms, Generate.

## Nebius x NVIDIA Global AI Hackathon notes

- **Track:** Best Apps and Agents.
- **NVIDIA open models used:** Nemotron 3.5 Super VL
  (`nvidia/Nemotron-3.5-Super-VL`) reads the artwork, and Nemotron-3-Super-120B-A12B
  (`nvidia/nemotron-3-super-120b-a12b`) writes every listing on the primary
  path - both served via Nebius Token Factory, so the whole primary pipeline
  runs on NVIDIA open models. If Token Factory is unreachable or no
  `NEBIUS_API_KEY` is configured, a labeled Cloudflare Workers AI fallback
  serves degraded output and the results page names the actual models used.
- **Where Token Factory accelerated the workflow:** a single OpenAI-compatible
  endpoint hosts both the multimodal and the reasoning model, so the whole AI backend
  is one fetch integration with no infrastructure to run.
- **What was significantly updated during the Submission Period:** the original tool
  (built October 2026, before entry) ran entirely on Cloudflare Workers AI. The
  hackathon version re-engines both AI steps onto Nebius Token Factory with NVIDIA
  Nemotron models, adds Tavily live trend grounding as a new pipeline stage, surfaces
  the trend research in the UI, and adds engine metadata to every response.
