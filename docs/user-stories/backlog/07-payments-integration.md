---
story: Payment integration (STUB — needs design)
created: 2026-06-24
---

> ⚠️ **Placeholder.** This story is captured so it is not forgotten, but it is **not
> ready to shape or build**. The shape and direction are still open — fill in the
> decisions below before running `/agile:shape`.

## Description

Add payment capability so the backend can charge users — most likely for access to the
API itself (subscription/seat) and/or per-feature billing. How exactly this should work
is undecided.

## Big questions to resolve first

- **What are we charging for?** API access subscription, per-user seats, usage/metered,
  one-off purchases, or a mix?
- **Provider**: Stripe (most common, strong Laravel support via Cashier), Paddle (handles
  EU VAT / merchant-of-record), Mollie (EU-friendly, used a lot in NL), or other?
  - Note: Greenhost/NL context → Paddle or Mollie may simplify VAT vs Stripe.
- **Model**: recurring subscriptions vs one-off charges vs both.
- **Where does state live?** Webhooks from the provider are the source of truth for
  payment status — need an endpoint + signature verification + idempotency.
- **Relationship to users**: billing is per-user (ties to [05-entity-ownership] and
  [06-user-management]) or per-organization/team (which we do not have yet)?
- **Gating**: what happens to an unpaid/expired user — read-only, blocked (`402`/`403`),
  or grace period?

## Likely building blocks (once direction is set)

- Laravel **Cashier** (Stripe or Paddle) for subscription plumbing, or a thin Mollie
  integration.
- A `subscriptions`/`billing` table or Cashier's tables tied to `users`.
- A webhook endpoint (provider → us) with signature verification and idempotent handling.
- Middleware to gate API access by subscription status.

## Out of scope (for now — everything, until designed)

This story does not yet have acceptance criteria. It must be split into concrete,
testable stories after the questions above are answered.

## Next step

Discuss the questions above, pick a provider and billing model, then rewrite this as one
or more buildable stories (e.g. `07-stripe-subscriptions`, `08-billing-webhooks`,
`09-access-gating`).
