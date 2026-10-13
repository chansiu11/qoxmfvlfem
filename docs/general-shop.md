# General-mode store and combat adaptation

Scope: general/spike mode only. Deathmatch and battle royale keep their loadouts, HP and armor rules.

## Player flow
- 30-second preparation, shop opens at each round start. B or the shop button opens/closes it; purchases require being alive in own spawn during prep.
- 1/2 and the on-screen weapon buttons switch primary/secondary. Tab opens the store in general mode.
- Start at 800 credits with a Classic and 100 HP. Credit limit 9000.
- Kill +200, plant +300 for the attacking team, round win +3000, consecutive losses +1900/+2400/+2900.
- Survivors keep guns and remaining armor. Dead players lose gear and receive a Classic next round. Guns receive ammunition at round start.
- Only purchases made during current preparation can be refunded. Replacing a current-round purchase refunds it before charging the replacement; the prior carried item is restored on refund. Carried equipment cannot be sold for credits.
- Host validates cost, ownership, buy zone, phase, round and request sequence. Guest snapshots cannot replace credits/shields/loadout. This remains the existing P2P host authority, not a Render migration.

## Sources and adaptation limits
- Names and categories: https://playvalorant.com/ko-kr/arsenal/
- Catalog snapshot: https://valorant-api.com/v1/weapons?language=ko-KR and /v1/gear?language=ko-KR (community extracted data, fetched 2026-10-13). Includes 20 guns present in the endpoint, including Bandit and Warden. Standard gun/gear illustrations use the endpoint's displayIcon URLs; no skins or abilities added.
- Shield reference: https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-9-10/
- Light 400 / 25 shield; Heavy 1000 / 50 shield, 66% absorption until shield expires. Regen 650 / 25 shield / 50 reserve, 100% absorption, 3-second delay then 25 points/sec regeneration in this adaptation.
- Imported price, body damage bands, magazine, pellet count, base fire rate and reload time. Range damage uses 40 game units/metre. Current top-down collision uses body hits; no head/leg regions or wall penetration. ADS alternate bursts, original recoil patterns, equip animation timings, gun drops/pickups and exact reserve counts are not replicated. Reserve ammunition is four magazines. The existing alternating-side round format remains.
- Store uses Valorant-style category columns, team/economy sidebar and armor/details pane, with this game's teal/slate/gold treatment and mobile layout.

Validation: packed-code VM tests exercise purchase/replay rejection, host/guest protected state, survivor/death round transitions, credit rewards, refunds, shield absorption/regeneration, actual Vandal projectile damage, store lifecycle, and previous mode/audio behavior. No real browser/device visual test was available in this environment.
