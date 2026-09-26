# StockSense Backend — Background Jobs Analysis

---

## Conclusion

**No background jobs, scheduled tasks, cron jobs, or async workers are required for this backend.**

---

## Analysis

The following potential background job areas were reviewed against all technical documents:

| Area | Required? | Reasoning |
|---|---|---|
| Stock-update processing | ❌ No | All stock mutations happen synchronously inside Validate endpoints |
| Low-stock notifications | ❌ No | Low-stock data is surfaced via Dashboard KPI API (`/dashboard/kpis`), polled by the frontend. No push notification requirement exists in the spec. |
| Reorder rule automation | ❌ No | Reorder min/max qty fields exist on products but no automatic purchase order generation or alert dispatch is required by the spec |
| OTP expiry cleanup | ❌ No | OTPs expire via `expires_at` field checked at validation time. Stale rows do not cause functional issues. Cleanup is cosmetic and not required for the hackathon. |
| Scheduled reports | ❌ No | No scheduled report generation is mentioned anywhere in the spec |
| External sync / webhooks | ❌ No | No external system requires periodic sync |
| Email delivery | ❌ No | OTP is returned in API response during hackathon dev (TD-005); no async email queue needed |

---

## Decision

Background job infrastructure (BullMQ, node-cron, etc.) will **not** be introduced.

This keeps the stack simple and eliminates a category of debugging risk during the hackathon window.

If low-stock push notifications are added post-hackathon, a simple cron job querying `products` against `stock_quants` and emitting events would be the natural extension point.
