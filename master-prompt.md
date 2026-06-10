# MASTER PROMPT — Real-Time Collaborative Drawing Platform

## Project Identity
You are building a browser-based real-time multiplayer collaborative
drawing platform. Users join temporary rooms, receive a shared creative
prompt, draw simultaneously on a synchronized canvas, and communicate
via live voice chat. The system prioritizes low-latency sync, clean
multiplayer state management, and an immersive UI.

---

## Tech Stack (Strictly Follow)

### Frontend
- Framework: Next.js 16 (App Router)
- Styling: Tailwind CSS + CSS variables for theming
- Canvas: HTML5 Canvas API (no third-party canvas libs)
- Real-time client: Socket.io-client
- Voice: WebRTC (native browser APIs, PeerJS as signaling wrapper)
- State: Zustand

### Backend
- Runtime: Node.js with Express
- Real-time: Socket.io server
- Signaling: PeerJS Server (for WebRTC)
- Session store: In-memory (no DB needed for v1)

### Project Structure
/frontend    → Next.js 16 (App Router) — deployed as Railway Service 1
/backend     → Express + Socket.io + PeerJS — deployed as Railway Service 2

Shared types: duplicate /frontend/types/shared.js and /backend/types/shared.js
Keep them in sync manually. Do not use a monorepo or package.json workspaces.

---

## Core Data Contracts (Define these first, never change them)

### DrawEvent
{
  type: 'stroke_start' | 'stroke_move' | 'stroke_end' | 'clear' | 'undo',
  userId: string,
  x: number,
  y: number,
  color: string,
  brushSize: number,
  timestamp: number,
  strokeId: string
}

### Room
{
  id: string,
  code: string,           // 6-char invite code
  hostId: string,
  players: Player[],
  status: 'waiting' | 'drawing' | 'replay' | 'ended',
  prompt: string,
  drawEvents: DrawEvent[],
  timerDuration: number,  // seconds
  createdAt: number
}

### Player
{
  id: string,
  name: string,
  peerId: string,         // WebRTC peer ID
  color: string,          // assigned cursor/stroke accent color
  isConnected: boolean
}

---

## Features to Build (Ordered by priority)

### Phase 1 — Core (Build this completely before Phase 2)
1. Room creation with 6-char invite code
2. Room joining via code
3. Player presence list with connection indicators
4. Shared canvas: brush, eraser, color picker, brush size
5. Real-time stroke sync via Socket.io (broadcast DrawEvents)
6. Undo (per-user last stroke only)
7. Countdown timer with server authority
8. Session lock when timer ends

### Phase 2 — Voice & Replay
9. WebRTC voice via PeerJS (auto-connect on room join)
10. Speaking indicators on player list
11. Replay engine: re-render DrawEvents chronologically
12. Playback controls (play/pause/speed)

### Phase 3 — Polish
13. Random matchmaking (public room queue)
14. Creative prompt bank (50+ prompts, randomly assigned)
15. Live cursors with player color labels
16. Reaction system (emoji reactions during replay)

---

## Socket.io Event Schema (Implement exactly)

### Client → Server
- room:create { playerName }
- room:join { code, playerName }
- room:leave
- draw:event { event: DrawEvent }
- game:start (host only)
- game:ready (player ready signal)

### Server → Client
- room:state { room: Room }
- room:player_joined { player: Player }
- room:player_left { playerId: string }
- draw:event { event: DrawEvent }        ← broadcast to all in room
- game:timer { remaining: number }       ← every second
- game:start { prompt: string }
- game:end
- error { code: string, message: string }

---

## Canvas Implementation Rules
- Canvas element: fixed aspect ratio 16:9, responsive width
- Coordinate normalization: always store x/y as 0–1 floats,
  multiply by canvas.width/height on render
- Stroke smoothing: use quadraticCurveTo, never lineTo for moves
- Layer model: single canvas, redraw full event log on undo
- On new DrawEvent received: apply immediately to local canvas
- Cursor: hide native cursor on canvas, render custom colored
  dot per user using a transparent overlay canvas

---

## Voice (WebRTC/PeerJS) Implementation Rules
- PeerJS server runs on same Express instance (/peerjs path)
- On room:state received, connect to all existing peers
- On room:player_joined, connect to new peer
- Use getUserMedia with { audio: true, video: false }
- Attach remote streams to hidden <audio> elements (autoplay)
- Detect speaking via AudioContext + AnalyserNode (threshold: -50dB)
- Emit speaking state to Zustand store, reflect in UI

---

## UI/UX Directives
- Theme: dark mode only. Background #0d0d0d, surface #1a1a1a,
  accent #6ee7b7 (mint green)
- Font: Inter for UI, Space Mono for codes and prompts
- Canvas area: takes 70% of viewport width, centered
- Sidebar (30%): player list, timer, tools, voice indicators
- Timer: large monospace countdown, turns red under 10s
- No modals for critical actions — use inline state transitions
- Loading/connecting states must always be visible

---

## Code Quality Rules
1. All shared types live in /frontend/types/shared.js and /backend/types/shared.js
   — keep both files identical. Never define Room, Player, or DrawEvent inline.
2. Server is the single source of truth for room state and timer
3. Never trust client timestamps for game logic — use server Date.now()
4. DrawEvents are append-only on the server — never mutate history
5. All Socket.io handlers must have explicit error boundaries
6. Canvas draw functions must be pure: (ctx, events[]) => void
7. No useEffect chains — use Zustand actions + socket listeners cleanly
8. Comment every non-obvious real-time sync decision with // SYNC:

---

## Build Order for Each Phase
For every feature, follow this exact sequence:
1. Define/update types in both /frontend/types/shared.js and /backend/types/shared.js
2. Implement server-side socket handler + room state mutation
3. Implement client socket listener + Zustand store update
4. Implement UI component consuming Zustand state
5. Test the full event round-trip before moving to next feature

---

## Deployment Configuration

### Backend (Railway)
- Root Directory: /backend
- Start command: node index.js (or npm start)
- Expose PORT from environment: const PORT = process.env.PORT || 4000
- PeerJS server mounts on same Express instance at /peerjs

### Frontend (Railway)
- Root Directory: /frontend
- Framework: Next.js (Railway auto-detects)
- Environment variable: NEXT_PUBLIC_BACKEND_URL=<your backend Railway URL>
- All socket/WebRTC connections must read from this env var, never hardcode localhost

---

## Out of Scope (Do NOT build unless Phase 3 is complete)
- Database persistence
- Authentication / user accounts
- Ranked matchmaking
- Mobile touch support
- Spectator mode

---

## Known Hard Problems (Handle explicitly, do not skip)

### Concurrent stroke ordering
Two users drawing simultaneously may have strokes arrive out of order.
Solution: sort DrawEvents by timestamp before render; accept small
visual reorder artifacts rather than blocking renders.

### Canvas resize sync
When browser window resizes, canvas pixel dimensions change.
Solution: always work in normalized 0–1 coordinates; rerender full
event log on resize.

### WebRTC reconnect
If a peer disconnects mid-session, the P2P connection must recover.
Solution: on player:rejoined event, re-initiate PeerJS call to that
peer; store peer connections in a Map keyed by playerId.

### Timer drift
Client timers drift from server over time.
Solution: server emits game:timer every second with authoritative
remaining value; client displays this directly, no local countdown.

---

## Definition of Done for v1
- [ ] Two users can join the same room via invite code
- [ ] Both see each other's strokes within 100ms on localhost
- [ ] Voice works in Chrome between two tabs/machines
- [ ] Timer counts down server-side and locks canvas at 0
- [ ] Replay animates all strokes in sequence after session ends
- [ ] UI clearly shows who is connected and who is speaking