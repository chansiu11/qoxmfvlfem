# General-mode tactical bots

Only the spike/general-mode adapter uses `spike-tactics.js`; deathmatch and battle royale continue calling their existing AI update.

Team plans alternate grouped entry, split entry through Mid, and an initial default-control pause. Attackers can rotate after recent team vision reports show multiple defenders near the planned site, with time and cooldown checks. Human spike carriers determine which site teammates support. Defenders distribute between A, B and Market; recent sightings can trigger support rotations. After planting, attackers hold approaches and defenders approach together briefly, with one designated defuser and other bots supporting. The wait is skipped near the defuse deadline. A nearby teammate's visible fight triggers trade support.

Combat alternates a short lateral reposition, settling, and stationary bursts. Reloading and low health trigger cover searches; footsteps use quiet movement on cautious approaches. The existing reaction delay, aim error, field of view, line of sight, friendly firing-lane check, pathfinding and weapon movement limits remain active. These are scripted adaptations of tactical play, not a model trained on player footage or a claim of human-level skill. No agent abilities are added.

References: Riot, VALORANT Patch Notes 3.0 (stopping before shooting and walking accuracy); Riot, Peeking into VALORANT's Netcode (movement accuracy and angle holding); Red Bull Campus Clutch map strategies and Ascent guide (Mid control, split attacks, rotations).

Tests cover expiring/team-private reports, evidence-based rotations, planting, one defuser, stationary firing, and actual pathfinding from spawn through a site approach to completed planting. Browser/device playtests are not represented by the Node simulation.
