# General-mode store and combat adaptation

Scope: general/spike mode only. Deathmatch and battle royale keep their loadouts, HP and armor rules.

## Player flow
- 30-second preparation, shop opens at each round start. B or the shop button opens/closes it; purchases require being alive in own preparation side during prep.
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

## Damage/audio balance revision
All modes now apply 80% of their previous gun damage, including every catalog distance band and shotgun pellet. Shop damage figures use the same adjusted data. Each of the 20 catalog guns and three legacy weapons has a distinct procedural transient/body/mechanical-tail profile; spatial positioning, occlusion and mute remain unchanged. These are custom synthesized effects, not recordings from Valorant.

## General-mode movement and run-and-gun revision

Imported runSpeedMultiplier from the community weapons endpoint again on 2026-10-13, converting the 6.75 m/s base into held-weapon speed. Speeds range from 5.0625 m/s (Bucky/Judge) through 5.13 (Operator/Ares/Odin), 5.4 (rifles, Sheriff/Shorty/Marshal/Outlaw), to 5.7375 (remaining pistols and SMGs). Shift uses 60% of the held-weapon speed. Human and bot movement budgets use the same weapon table.

Movement spread is explicitly a 2D balance adaptation, not copied original recoil. Each weapon adds a full-cone moving error of 7–28 degrees; rifle baseline Vandal adds 18 degrees, Spectre 8, Operator 28. Walking applies 25% of that movement error; analog speeds interpolate. Actual local displacement is sampled before firing, so pressing against a wall does not count as moving. Remote speed travels with player snapshots. Stationary baseline accuracy is unchanged. A centered Vandal shot with the movement cone has an idealized ~39% intersection probability at 10 m and ~20% at 20 m against radius-25 collision; this geometric calibration is not a real-device playtest. Gameplay motivation: https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-9-10/ (movement error and relative SMG mobility).

Bucky, Judge and Shorty receive an additional 25% damage reduction across their distance bands, including each pellet. Other modes' original movement/spread/shotgun damage remain unchanged in this revision. Store displays the adjusted damage, movement speed, quiet speed and movement cone.

## Close-range shotgun revision
General-mode pellet damage by distance in metres (0–4 / 4–7 / 7–10 / 10–15 / 15+): Bucky 22 / 8 / 2.5 / 0.5 / 0; Judge 18 / 6 / 2 / 0.4 / 0; Shorty 15 / 5 / 1.5 / 0.3 / 0. End boundaries belong to the next band. Close damage is increased strongly while distant damage quickly becomes negligible, then zero. Values are per pellet, not guaranteed per shot; armor and pellet misses still apply. This supersedes the previous flat shotgun reduction. Other modes and guns are unchanged.

Shotgun midrange follow-up: 4–7 m per-pellet damage increased to Bucky 15, Judge 12, Shorty 10; 7–10 m increased to 7, 6, 4.5 respectively. The 0–4 m and 10 m+ bands are unchanged.

## Valorant shotgun stats restored (supersedes custom damage bands)
Requested original shotgun reference: refreshed community weapon data on 2026-10-13, with Bucky near damage and minimum spreads checked against Riot patch 12.09: https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-09/ . Normal-fire body damage per pellet: Bucky 17 (<8m), 13 (8–12m), 9 (12m+); Judge 17 (<10m), 10 (10–15m), 7 (15m+); Shorty 11 (<7m), 6 (7–15m), 3 (15m+). These replace all previous shotgun damage multipliers and the artificial 15m zero-damage cutoff. Imported pellet count, clip, normal fire rate, reload time and stationary base spread as well. Existing 2D movement-error tuning remains; no new alt-fire, head/leg hit regions or wall penetration is claimed. Applies only to general-mode catalog shotguns.
