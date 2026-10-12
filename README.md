# 2D 배틀필드 로얄 — dedicated Render server

The current Battle Royale / Deathmatch game now connects to a dedicated WebSocket server. Room ownership controls lobby settings and start permission only. Maps, bots, projectiles, damage, doors, zone progression and match results continue on the server when the owner leaves, while at least one player remains.

## Run

```sh
npm ci
npm test
npm start
```

Open http://localhost:3000. Render uses `PORT`, `npm ci`, `npm start`, and `/health`. The health response includes `version: dedicated-v2`. `render.yaml` specifies Singapore and **manual deployment** (`autoDeployTrigger: off`). Existing Render settings must also be checked; committing this file alone does not change an existing manually-created service.

## Architecture and latency

- `public/game-core.js`: readable source extracted from the previous gzip/base64 game, retaining its map generation, combat, bots and rendering.
- `simulation.js` / `scripts/server-bridge.js`: room-local Node VM with a minimal UI adapter; no browser, canvas rendering or PeerJS on the server. This executes only trusted repository code, not user scripts.
- `room-worker.js`: dedicated worker thread per room, target 60 Hz simulation, 30 Hz snapshots. Physics uses bounded catch-up; overload can still slow the simulation.
- `server.js`: HTTP and WebSocket gateway. Ping replies bypass simulation workers. Nagle/compression are disabled; stale state snapshots are dropped above 32 KB queued data.
- `public/server-transport.js`: every device, including the room owner, is a server client. GitHub Pages points to `wss://breach-qoxmfvlfem.onrender.com/ws`; Render-hosted clients use the same origin.
- Nearby bot state targets 15 Hz, full bot repair 1.2 seconds, full item/door repair 4 seconds. Item changes use small events instead of sending the entire inventory list for every pickup. Map transfer uses a deterministic seed.
- A* navigation resumes across updates instead of blocking a complete frame; collision checks continue to use the existing wall geometry.
- Ping displays measured round-trip time with `performance.now()`; no artificial cap or division. **100 ms is a goal, not a guarantee.** Actual RTT depends on the player's route, server region, load and network. No Korea-to-Render measurement has been made by these tests.

Player movement and inventory selection retain the previous client-side behavior for responsiveness. This migration moves world simulation to the server; it is not a complete input-only anti-cheat rewrite. Client snapshots cannot spoof player identity, kill/death counts, teams, or undo locked server damage; shot cooldowns are checked server-side.

## Controls

Desktop controls are preserved. On mobile, the right touch area **only aims**. The new **발사** button fires while held, independently of the aiming finger; release, touch cancellation, backgrounding or loss of focus stops fire. The fire button participates in the existing mobile key layout editor.

## Deployment order

Deploy matching frontend and server together. Do not merge the new GitHub Pages client before the dedicated server has been deployed and its health endpoint reports `dedicated-v2`.

Rooms, matches and items are in memory. Empty rooms are deleted; restarts/redeploys end matches. Owner departure transfers lobby controls, not simulation. This version requires rejoining from the lobby after a connection closes; mid-match reconnect is not implemented. Capacity guardrails are 4 rooms, 20 players per room and 200 sockets, not a guaranteed capacity estimate. Up to 100 BR bots are preserved, but they can exceed the frame budget on limited CPUs.

## Verification

`npm test` checks real WebSocket room joining, owner authorization/transfer, continued snapshots after owner exit, movement propagation, ping, cleanup, bot/map simulation, projectile damage, shot rate limiting, slow-client snapshot drops, and independent mobile aim/fire touch handlers. Browser visual testing and real-device RTT should be done after deployment.
