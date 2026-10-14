# General-mode tactical bots

Only the spike/general-mode adapter uses `spike-tactics.js`; deathmatch and battle royale continue calling their existing AI update.

Team plans alternate grouped entry, split entry through Mid, and an initial default-control pause. Attackers can rotate after recent team vision reports show multiple defenders near the planned site, with time and cooldown checks. Human spike carriers determine which site teammates support. Defenders distribute between A, B and Market; recent sightings can trigger support rotations. After planting, attackers hold approaches and defenders approach together briefly, with one designated defuser and other bots supporting. The wait is skipped near the defuse deadline. A nearby teammate's visible fight triggers trade support.

Combat alternates a short lateral reposition, settling, and stationary bursts. Reloading and low health trigger cover searches; footsteps use quiet movement on cautious approaches. The existing reaction delay, aim error, field of view, line of sight, friendly firing-lane check, pathfinding and weapon movement limits remain active. These are scripted adaptations of tactical play, not a model trained on player footage or a claim of human-level skill. No agent abilities are added.

References: Riot, VALORANT Patch Notes 3.0 (stopping before shooting and walking accuracy); Riot, Peeking into VALORANT's Netcode (movement accuracy and angle holding); Red Bull Campus Clutch map strategies and Ascent guide (Mid control, split attacks, rotations).

Tests cover expiring/team-private reports, evidence-based rotations, planting, one defuser, stationary firing, and actual pathfinding from spawn through a site approach to completed planting. Browser/device playtests are not represented by the Node simulation.

During the 30-second preparation phase, bots now choose and travel to staging positions based on the same round plan: attacking A/B approaches or Mid Top for split entry, defending A/B site entrances or Mid Bottom. Navigation checks the entire path against the team's preparation area, so shortcuts through neutral/enemy territory are rejected. Bots hold and watch the approach when they reach their target. Purchases are valid throughout the connected preparation side.

Preparation boundary correction: attackers stop at A Lobby's exit, B Lobby's exit, and Mid Top instead of being able to occupy the forward A/B Main approaches. Defender boundaries remain on the site/Tree/Mid Bottom entrances. `PREP_STAGING` is shared with the tactical AI so waiting positions track these limits rather than using separate hard-coded coordinates. These are boundaries for the existing hand-built 2D Ascent geometry, not verified Riot collision/barrier coordinates.
