# Screens, sections and logic

Rules used on every screen
- Working days exclude Fridays (October: 26, 3 elapsed at the data date).
- Comparisons use periods of the same length: Oct 1-4 against Sep 1-4, week-to-date against the same days of the previous week.
- DSR and ASR are shown only for complete periods (recent parcels have no final outcome yet); they are never aggregated over a partial period.
- Pickups targets come from the October sheet; ASP targets are taken as given, with no growth factor.

## 0. Login and level bar
The app opens on the login screen (`docs/ACCESS.md`). Level bar pills: VP, Heads, Team leaders, Sales, AMs: only the levels the signed-in person may open are shown, with the person's name, access level and Sign out on the right.

## 1. VP and Heads screens
VP is the company view (one row per head). Heads has one horizontally scrollable tab per team: Key Accounts, Growth Fashion, Growth General Trade, Growth Cosmetics, Startups; a head only gets his own team's tab. Both have the same order:
1. **Where the team stands against targets** (always first). Cards: monthly pickups target (from the sheet), pickups so far with % of the monthly target, daily average (with the target pace), required daily average for the rest of the month, run rate (pickups so far + current daily average x remaining working days), a status (Achieved, On track, At risk within 10% below the monthly target, Behind) and a sentence on how far the team is. Then ASP, fresh sales, retention and churn against their targets. Then a table of the children (pickups columns only: ASP, fresh sales, retention and churn are in the cards above it): heads (VP) or team leaders plus sales reporting directly to the head (team tab), with pickups / monthly target, daily average actual / target pace, run rate, shortfall, status, ASP, fresh sales, retention, churn. No merchant-level hit / missed detail here.
2. **Main view**
   - Base: total portfolio, active merchants (a pickup this month so far), churned merchants (active in September, no pickup yet), retention rate, churn rate.
   - Activity: total pickups, average daily pickups, total ASP, fresh sales pickups (absolute) and their contribution (fresh pickups / (portfolio pickups + fresh pickups of merchants not in an AM portfolio), so nothing is counted twice).
   - Top 10 and Bottom 10, one list at a time from a dropdown. Default: the pickups target (top 10 that hit / did not hit their own target). The dropdown then covers every target KPI (ASP target: positive / negative gap contributors, with the ASP of the same days last month and the change; retention target: the churned merchants; fresh sales target; churn target: last month's new merchants retained / churned) and the exploratory lists: merchants by pickups, by ASP; low DSR merchants (September DSR at or below 65%, largest volume first, with the count and share of September volume); top 10 growers and droppers (Oct 1-4 vs Sep 1-4); top 10 negative and positive ASP gap contributors (parcel share x (ASP - scope target)); top 10 and bottom 10 VAS users. A minimum-parcels input (default 30) keeps tiny merchants out of the ASP and VAS bottom lists. Ties are broken by Business ID.

## 2. Team leader screen
Same sections as above for the team leader's own scope, plus the layer above the business level: every AM and every sales rep is a row that opens in place with that person's standing cards and their own Base, Activity and rankings, and a button to open the full Target Tracker / sales view. The team leader never has to leave the screen to understand an AM.

## 3. Permissions (who can see whom)
- VP: every head, team leader, AM and sales manager.
- Head: the team leaders, AMs and sales managers of his own team.
- Team leader: the AMs and sales managers of his own team.
- AM and sales manager: only their own view.
In this file the scoping shapes the screens only (the whole data set is embedded). Real enforcement belongs in the API (`docs/ARCHITECTURE.md`, T5 and T7): every request is filtered by the person's subtree.

## 4. Sales view
- Cards: New pickups (merchants whose first pickup was this month), ASP of those merchants, Churn of last month's new merchants.
- Churn target: Growth/Key sales' sheet value 0.81-0.86 is read as retention, so max churn = 1 - value (14-19%); Startups' unlabelled 0.25 = max churn 25%.
- Tables: new merchants this month; last month's cohort with Active / No pickup yet (owner from the end-of-September snapshot). Business ID and Business name filters apply as you type.

## 5. AM Target Tracker (main screen)
- Header: AM selector, Portfolio overview button.
- Pickups achievement vs. Target: pickups so far / Target, Target = 80% of the monthly pickups target; 100% = reached.
- ASP and Retention cards (retention provisional; Startups AMs have no retention target).
- Stat cards: Monthly pickups target; Target daily avg (monthly target / working days); Actual daily avg (pickups so far / working days elapsed); Required daily avg for the rest of the month; Run rate (so far + current daily average x remaining working days); gap banner when behind. The achievement card sits beside ASP and Retention.
- Merchant status cards: Hit target, Didn't hit target, Churned, New (add up to the merchant total). New = first pickup this month; Churned = no pickup yet this month (inflated early in the month); hit/missed applies to existing and reactivated merchants: MTD daily average vs the merchant's own target = (September e-commerce + fulfillment pickups x 1.60) / 26.
- Merchant detail table, Pickups view: target daily avg, MTD daily avg, MTD total, delta, achievement %, below-own-target %, category. A row expands to growth: Grower (>= +15%) / Dropper (<= -15%) vs the same days of last month.
- Merchant detail table, ASP view: cards (total eligible revenue, delivered parcels, portfolio ASP, net gap), merchant-group chips, five merchants causing most of the gap / lifting most, business interpretation, how-to box, CSV download, then the table: Merchant, Parcels, Merchant ASP, Parcel Share, ASP Gap Contribution, Revenue Gap to Target, Merchant Group, then Shipping ASP, VAS ASP, Change vs Sep 1-4.
  - Portfolio ASP is parcel-weighted, never the simple average of merchant ASPs.
  - ASP Gap Contribution = Parcel Share x (Merchant ASP - Target): how much the merchant pulls the portfolio average down or up; the column adds up to the portfolio gap.
  - Revenue Gap to Target = (Target - ASP) x parcels. Merchant Group = High/Low Volume (parcel share vs the median) x High/Low ASP (vs the target).
  - Row detail: plain-words explanation, scenarios for ASP +0.5 / +1 / +2 / +5 EGP and +10%, for +10 / +25 / +50% parcels at the same ASP, shipping vs VAS comparison with VAS to the portfolio average / top quarter, and a suggested focus. These are arithmetic scenarios, not predictions.

## 6. AM portfolio overview
- Filter: Business ID and Business name apply after 2 characters. One match shows that merchant; several show their combined numbers (DSR exact, ASR approximate before October); clearing returns to the portfolio.
- Hero cards: active merchants, volume, revenue, DSR, ASR, compensation. Same-days comparison with the previous period shown in absolute numbers; DSR/ASR show the last complete month.
- Flags: merchants and activity, segments, DSR status (low at 65% or below), VAS adoption, sub-accounts, websites known; Seasonality and Facebook ads show "Coming soon".
- 6a Overall overview: from/to dates + Daily/Weekly/Monthly; "Who drives this portfolio" (top merchants, status mix); charts Volume, Revenue, Active merchants, ASP (shipping and VAS), Compensation, DSR, ASR, Lost & damaged; period table coloured against the previous period (+/-2% = stable; month-to-date row never coloured).
- 6b Comparison: Day / Week / Month with presets and custom pickers; metric selector, delta card, current value first then earlier same-length periods, chart, all-metrics table.
- 6c Current month overview: Daily / Weekly / Monthly (same days of both months).
- 6d Issues: Operational (cards, trends, which merchants, current-month parcel tables: lost and compensation match the cards, fake attempts and RTO are proxies); CX (tickets by day, status, category, agent; opened, pending and compensation lists); Customers (consignee scores) (failed attempts by day and reason, grouped by side from the reason text; latest 10 per merchant).
- 6e Opportunities: VAS revenue by type (selected month and the two before), delivered parcels by zone.
- 6f Analysis, Debugger: placeholder tabs, content to be defined.

## 7. Single-merchant view (inside the overview)
Same tabs at merchant level with merchant flags: segment, lifecycle (new / retained / reactivated), account (sub-account of a main account, or main with N sub-accounts), DSR status, VAS level, creation source, website, pickup locations.

## Sales view
Also shows New accounts (MTD): the merchants whose first pickup was this month and who have the rep as owner.

## VP, head and team leader views: segment tabs and "View merchants" (November 2026)

- VP tabs: Totals, the five segments, then **Box** and **No segment** (and **Other segments** when it has merchants). A Box / No segment tab shows the same activity analysis, segment table and top / bottom lists as a segment, for the VP-only merchants of that group (active this month; a new or reactivated merchant since the 25th of last month). There are no targets for these groups.
- "View merchants" on any card first shows an aggregated table of that card's merchants: per segment (VP), per team leader (head), per account manager and sales rep (team leader; a merchant counts once, under its AM when the AM is in the team, otherwise under the sales rep it came with). Columns: merchants, active, MTD pickups, same days last month, delta, GR %, share of pickups, with a total row. Clicking a row narrows the merchant list below to that group; "Show all" resets it.
