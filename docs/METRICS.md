# Metric dictionary and decisions

## Definitions
| Metric | Definition |
|---|---|
| Working days | Days excluding Fridays. October: 26. |
| Merchant pickups target (average daily) | (September e-commerce + fulfillment pickups x 1.60) / 26. Factor 1.49 until September, 1.60 from October. |
| Target (the 80% bar) | 80% of the AM's monthly pickups target. The achievement bar is pickups only. |
| ASP | Delivery revenue total / parcels delivered. Targets from the sheet, no growth factor. Shipping ASP = (revenue - VAS) / delivered, VAS ASP = VAS revenue / delivered. |
| Portfolio ASP | SUM(revenue) / SUM(delivered); never the average of merchant ASPs. |
| ASP Gap Contribution | Parcel Share x (Merchant ASP - Target ASP); adds up to Portfolio ASP - Target. |
| Revenue Gap to Target | (Target ASP - Merchant ASP) x merchant parcels. A benchmark, not a forecast. |
| Merchant Group | Parcel Share >= median of eligible merchants = High Volume; ASP >= target = High ASP. Eligible = at least one delivered parcel. |
| Retention (AM) | Merchants with September pickups that have a pickup this month / merchants with September pickups. Provisional until month end. |
| New acquisition | The merchant's first pickup is in the month (`public.businesses.firstpickuppickedupat` = mart `joining_date`), with a sales owner. Not the sign-up date. |
| Sales churn | Last month's first-pickup merchants (owner from the end-of-month snapshot) with no pickup yet this month / cohort size. |
| DSR / ASR | numerator / denominator from the mart; complete periods only; weighted by pickups when merchants are combined (DSR exact; ASR approximate before October). |
| Same-length comparison | Month-to-date vs the same days of the previous month; week-to-date vs the same days of the previous week. |
| Growth status | Grower >= +15%, Dropper <= -15% (first N days of the month vs the same N days of last month, pickups per working day); otherwise Stable. |
| Monthly target | Every achievement figure (VP to AM and sales, bars, cards, tables) is measured against the monthly target of the targets sheet. There is no separate "Target" and no percentage of it. |
| Run rate | Pickups so far + the current daily average x the remaining working days (the old "estimated month-end"). Required daily average = what is still missing / the remaining working days; target pace = monthly target / working days of the month. |
| VP ASP target | The sheet has none: the average of the AMs' ASP targets weighted by their pickups targets (78.95 for October; the five heads' targets give 78.93). |
| Standing status (leadership views) | Achieved: pickups so far reach the monthly target. On track: the run rate reaches it. At risk: the run rate is within 10% below it. Behind: further below. Sales reps are judged against their new-pickups target as given. |
| Base (leadership views) | Portfolio = merchants of the AMs in scope; active = a pickup this month so far; churned = active in September with no pickup yet; retention / churn rate over the September-active base. |
| Fresh sales contribution | Fresh pickups / (portfolio pickups + fresh pickups of merchants that are not in an AM portfolio). 3 of the 30 fresh merchants are also in an AM portfolio. |
| Merchant categories | New (first pickup this month), Churned (no pickup yet), Reactivation (none in September, active before and now), Existing. |

## Decisions log
- Sales "Churn%" (Growth/Key, 0.81-0.86) is read as retention: max churn = 1 - value. The unlabelled Startups 0.25 is max churn. To confirm.
- AM "Retention Target" is a minimum. No combined weighted score yet: caps and the churn scoring rule are not agreed.
- Hajar Bahaa Eldin is under Mohamed Samir (TL targets only add up that way).
- Seasonality: "Coming soon" (the derived heuristic was removed). Facebook ads: "Coming soon".
- DSR/ASR for partial periods are not shown (cohort immaturity).
- Daily views skip Fridays.
- Merchant profile entry points were removed from the tracker table; a merchant is reached through the portfolio overview filter.
- Current-month parcel, ticket and failed-attempt detail is embedded (about 0.8 MB compressed); history is not. Failed-attempt rows are limited to the latest 10 per merchant.

## Known sheet inconsistencies
Fashion head fresh-sales target 27,600 vs 23,000 for the five listed Fashion sales; Startups TL targets only add up with Hajar Bahaa Eldin under Mohamed Samir.

## Known data caveats
- Ownership drifts: the embedded roster is as of Oct 5 (4,641 merchants); the warehouse showed 4,885 by Oct 9.
- Revenue in the packs treats a missing value as 0, so missing and zero are indistinguishable.
- Fake attempts and RTO without attempt in the parcel tables are proxies (591 vs 407 and 2,026 vs 5,064 for Trend Hub in September). Lost and compensation match the mart exactly; damaged is within a couple of parcels.
- About half of the tickets can be linked to a merchant.
- The mart's Oct 5 partial data is in the monthly Oct row; the daily packs end on Oct 4.

## ASP (all views)

ASP = (shipping revenue + VAS revenue) ÷ delivered parcels. No view shows a shipping-only or VAS-only ASP any more. Portfolio ASP = sum of revenue ÷ sum of delivered parcels, never an average of merchant ASPs.


## Merchant groups (AM, team leader, head and VP views)

Growers / Droppers / Stable (GR % vs the same days of last month, ±15%), Churned (no pickup this month yet), New (first pickup from the 25th of last month to the 25th of this month; its pickups, delivered parcels, revenue, ASP and average per working day count from the 25th of last month, not from the 1st, and are part of every total) and Reactivations (on 25th-to-25th months: no pickup from the 25th of two months ago to the 24th of last month, pickups since the 25th of last month, active before that; counted from the 25th of last month like new merchants). Each merchant is in exactly one group; the groups add up to the portfolio.
