# POD Listing Writer

Upload your artwork and get draft titles, tags and descriptions for Etsy,
Redbubble and TeePublic. Review each listing before publishing it.

Demo: https://pod-seo-tool.magpro369.workers.dev

## Verified status (October 29, 2026)

The public demo passed a real generation on Nebius Token Factory: NVIDIA
Nemotron 3.5 Super VL for vision and Nemotron 3 Super 120B A12B for writing.
The result names the actual backend and model used. Live trend search is
currently disabled. Listings are based on the image, not live market research.

## Pipeline

1. The browser resizes the uploaded image. The API rejects unsupported formats,
   images over 200 KB, and images over 1024 pixels on the long side.
2. `nvidia/Nemotron-3.5-Super-VL` describes the image via Token Factory.
3. `nvidia/nemotron-3-super-120b-a12b` writes platform-specific drafts. The
   prompt distinguishes printed artwork from garment construction.
4. `src/rules.js` clips and deduplicates tags, applies platform-specific length
   limits, and flags a small list of brand terms. This is not legal clearance
   or a guarantee of search ranking or marketplace acceptance.

Optional Tavily integration is implemented but disabled in this deployment.
The UI distinguishes disabled search from exhausted or unconfigured search.
If no Nebius key is configured, the code has a labeled Workers AI fallback.
Transport or HTTP failures can also take that labeled fallback path. Empty
model content is an explicit error, not a silent engine swap.

## Demo limits and cost controls

No signup or payment is required for visitors. The shared demo allows up to
5 attempts per IP per day and 100 globally per day, with lifetime caps of
500 generations and an $8 recorded-cost budget. Capacity can be exhausted.
A SQLite-backed Durable Object reserves estimated cost before a model call
and settles against reported API usage. Failed calls retain their reserve.
These controls reduce exposure; they are not a guaranteed account-balance
floor. See `docs/budget-math.md` for the estimate and its limits.

## Run and deploy

Use Node.js 22+, a Cloudflare account, and your own Nebius Token Factory key.
Provider usage can incur charges. Review rates and set your own limits first.

```sh
npm install -g wrangler
wrangler login
wrangler secret put NEBIUS_API_KEY
wrangler deploy
```

The Durable Object binding and SQLite migration are declared in
`wrangler.toml`. Leave `TAVILY_LIFETIME_MAX=0` to keep search disabled.
Never commit keys or `.dev.vars`.

Offline tests (no model calls):

```sh
node test/local.test.mjs
```

## Hackathon

Track: Best Apps and Agents, Nebius x NVIDIA Global AI Hackathon.
The October 2026 baseline used Cloudflare Workers AI. During the hackathon
work, both model stages were moved to NVIDIA Nemotron on Nebius Token Factory,
with runtime model metadata, image bounds, fail-closed budgets, measured-cost
settlement, artwork-versus-garment prompting and offline tests added.

## Repository history and license

MIT license. This public repository is a recreated web import of the project
source. Its web-import commits do not reproduce the original local development
history. No original development timestamps or ten-commit history are claimed
for this public import.
