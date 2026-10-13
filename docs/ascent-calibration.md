# General-mode spatial calibration

This is a hand-built top-down Ascent adaptation, not Riot geometry or a verified 1:1 recreation. Heights, ramps and agent silhouettes are not reproduced.

- Coordinate convention: 40 world units = 1 metre.
- Canvas/map reference: 4800 units = 120 m (previously 3600). This is a design approximation; the cropped/rotated official reference is not identical to the API minimap bounds.
- Unchanged player collision diameter: 30 units = 0.75 m; rendered torso diameter: 38 units = 0.95 m. These are gameplay choices, not verified Valorant agent dimensions.
- Normal movement: 5.4 m/s = 216 units/s; quiet movement: 3.24 m/s = 129.6 units/s. No extra sprint. All current weapon classes use the same rifle-based baseline.
- Movement uses elapsed time, capped at 50 ms after stalls. Bots share a per-frame distance budget between combat and objective steering; human diagonal movement is normalized.
- 10 m takes 1.852 s normally or 3.086 s quietly, independent of 30/60/120 FPS in unobstructed movement. Actual route times differ with spawn placement and simplified walls.

Evidence consulted (2026-10-13):
- https://github.com/yakisoba0728/vrfkit/blob/main/docs/DATA.md — community replay measurements report a 675 cm/s base lattice and 324 cm/s walking.
- https://valorant-api.com/v1/weapons — community extracted Vandal runSpeedMultiplier 0.8; 675 × 0.8 = 540 cm/s.
- https://valorant-api.com/v1/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319 — minimap projection 0.00007 per cm, giving 142.857 m across that entire minimap image, including margins. It does not establish the width of our differently framed reference.
- https://playvalorant.com/en-gb/maps/#ascent — visual layout reference.

Automated checks execute the packed game and cover player and bot distances, sprint suppression, diagonal movement, spawn/site connectivity and actual bot navigation. No real-device latency or visual playtest is claimed.
