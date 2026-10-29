# Demo cost controls (October 29, 2026)

This document describes the shipped configuration, not a provider guarantee.

- 5 attempts per IP per day; 100 attempts globally per day.
- 500 lifetime generations and an $8 recorded-cost budget.
- Tavily search disabled (`TAVILY_LIFETIME_MAX=0`).
- JPEG/PNG only, maximum 200,000 bytes and 1024 pixels on the long side.
- Nebius hard completion caps: 2000 vision tokens, 2400 writer tokens.
- Verified October 29 Token Factory list rates for both models: $0.30 per
  million input tokens and $0.90 per million output tokens.

The SQLite Durable Object atomically reserves estimated microdollar cost
before allowing a generation. The image input estimate is image area / 200
plus 500 tokens, with additional prompt allowance and the hard completion
caps. That image estimate is conservative against the observed example,
not a documented upper bound from the provider.

After each call, reported API usage settles the reserve to recorded actual
cost. Failed calls with absent usage retain their reservation. Future calls
fail closed if recorded cost plus the next reserve exceeds the configured
budget, if actual usage exceeds its reserve/cap, or if the budget service
cannot be reached.

An October 29 local generation reserved 5346 microdollars and settled to
1425 microdollars based on reported usage. This demonstrates settlement for
one run, not a guaranteed account balance or a bound on all images.

The reserve/settle guard reduces exposure. One in-flight call can exceed an
estimate before settlement. Provider pricing, tokenization, credits and
service policies can change. Review current rates and your own balance
before deploying with your own key. No paid plan upgrade or automatic
top-up is part of this application's workflow.
