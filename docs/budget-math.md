# Spend budget math

Prepared 2026-10-06 (pre-access); updated 2026-10-26: vision pass re-priced to
Nemotron 3.5 Super VL from the re-fetched catalog snapshot
(docs/nebius-tokenfactory-model-catalog-2026-10-26.md), and the Tavily
exhaustion decision below was made (was an open marker).

Goal (audit gate): prove the public demo cannot spend beyond VERIFIED free
grants. Numbers below are worst-case estimates from the dated Token Factory
catalog snapshot (docs/nebius-tokenfactory-model-catalog-2026-10-26.md);
every figure marked [verify] must be confirmed against the live account's
actual credit balance/entitlements BEFORE the first live call, and the global
budget must be set to the verified ceiling - not the estimates here.

## Worst-case cost per generation (Token Factory list prices)
- Vision pass, nvidia/Nemotron-3.5-Super-VL ($0.30/M in, $0.90/M out):
  ~2,000 image+prompt tokens in, 220 max out -> ~$0.0008 [verify token counts]
- Writer pass, nvidia/nemotron-3-super-120b-a12b ($0.30/M in, $0.90/M out):
  ~2,500 prompt+trend tokens in, 1,400 max out -> ~$0.0020 [verify]
- Retry/fallback multiplication: worst case both Nebius calls fail AFTER
  consuming tokens, then Workers AI fallback runs (Workers AI free tier
  [verify current free allocation]) -> count Nebius cost x1 anyway.
- Tavily: 1 basic search credit per generation; free Researcher plan =
  1,000 credits/month [verify remaining balance].
- Worst-case total: ~$0.003 per generation.

## Derived ceilings (to re-derive from verified balances)
- If verified Nebius credit = $25: ~6,000 generations lifetime. At
  GLOBAL_PER_DAY=100 the demo could run ~60 days at full cap. Submission
  (Oct 30) through judging end (Dec 15) = 46 days -> 100/day fits, but set
  GLOBAL_PER_DAY = floor(verified_credit / worst_case_cost / days_until_dec16)
  with a safety factor of 2.
- Tavily: 100/day * 31 days = 3,100/month > 1,000 free credits -> Tavily is
  the binding constraint at 100/day. DECISION (2026-10-26): grounded
  generations are capped by TAVILY_LIFETIME_MAX, a lifetime counter enforced
  atomically in the Budget Durable Object. The shipped default is 0, which
  disables grounding entirely - an unknown balance means no Tavily calls.
  Set it only from the VERIFIED current balance before the first live call
  (floor of verified remaining credits, with a safety margin), because an
  existing account may have already spent part of its free quota. When the cap is reached, generations continue
  WITHOUT the Tavily call, meta.grounded = false, and the results page shows
  an explicit "live trend grounding unavailable" note instead of silently
  dropping the trends block. There is no paid Tavily path - no plan upgrade,
  no billing - the app degrades honestly.
- Workers AI fallback: stays within its own free daily allocation; if
  exhausted, the API returns an error and the budget gate has already counted
  the spend - acceptable (fail closed), no paid path exists.

## Hard rules
- No paid plan upgrades anywhere; if a free grant is exhausted, that stage
  degrades honestly (labeled) or the generation is denied.
- GLOBAL_PER_DAY / FREE_PER_DAY are Cloudflare vars - changeable without a
  redeploy when verified numbers land.
- Re-check remaining Nebius credit after the first 10 live generations and
  reconcile with this model.
