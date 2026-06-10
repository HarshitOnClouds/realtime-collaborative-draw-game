# 🎨 drawwithme

A real-time collaborative drawing game inspired by Gartic Phone. Draw with friends on a shared canvas, chat, react, and even voice chat — all in real time.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socket.io&logoColor=white)
![PeerJS](https://img.shields.io/badge/PeerJS-orange?style=flat)

---

## ✨ Features

### 🖌️ Drawing Tools
- **Brush** — freehand drawing with adjustable size & color
- **Eraser** — erase parts of the canvas
- **Shapes** — rectangle, circle, and line tools with live preview
- **Text** — click anywhere on the canvas to place text
- **Color Picker** — preset palette + custom color input
- **Undo / Redo** — per-user stroke history with `Ctrl+Z` / `Ctrl+Y` support

### 🌐 Real-Time Collaboration
- **Live cursors** — see where other players are drawing in real time
- **Conflict-free syncing** — server-authoritative append-only event log
- **Instant broadcast** — all draw events are relayed via WebSocket with minimal latency
- **Player presence** — join/leave indicators and connection status

### 🎮 Game Mechanics
- **Prompt system** — random drawing prompts assigned each round
- **Configurable timer** — host picks round duration (30s, 60s, 90s, 2m, 5m)
- **Server-authoritative timer** — all players see the same countdown
- **Drawing replay** — after the round ends, watch a full replay of the drawing at adjustable speed (0.5x – 4x)
- **Spectator mode** — join a room as a spectator to watch without drawing

### 🏠 Room System
- **Private rooms** — create a room and share the 6-character code
- **Public rooms** — browse and join open lobbies
- **Quick Play matchmaking** — queue up and get auto-matched with other players
- **Host controls** — start game, clear canvas, restart rounds

### 💬 Communication
- **Text chat** — in-room chat with colored usernames
- **Voice chat** — peer-to-peer audio via PeerJS/WebRTC
- **Emoji reactions** — send floating reactions (👍 ❤️ 😂 🔥 🎉) that animate across the canvas

### 📦 Other
- **Export as PNG** — save the canvas as an image
- **Keyboard shortcuts** — `B` brush, `E` eraser, `T` text, `Ctrl+Z` undo, `Ctrl+Shift+Z` / `Ctrl+Y` redo

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | [Next.js 16](https://nextjs.org/) (React 19) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) |
| **State** | [Zustand](https://github.com/pmndrs/zustand) |
| **Real-time** | [Socket.IO](https://socket.io/) (client + server) |
| **Voice** | [PeerJS](https://peerjs.com/) / WebRTC |
| **Backend** | [Express 5](https://expressjs.com/) + Node.js |

---

## 📁 Project Structure

```
realtime-collaborative-draw-game/
├── backend/
│   ├── index.js            # Express + Socket.IO + PeerJS server
│   ├── package.json
│   └── types/              # JSDoc type definitions
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.js             # Home — lobby, matchmaking, room join
│   │   │   ├── room/[code]/page.js # Room — canvas, tools, chat, players
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── Canvas.js           # Main drawing canvas + overlays
│   │   │   ├── ReplayCanvas.js     # Post-game drawing replay
│   │   │   └── VoiceChat.js        # PeerJS voice chat
│   │   ├── lib/
│   │   │   └── socket.js           # Socket.IO client singleton
│   │   └── store/
│   │       └── useStore.js         # Zustand global state
│   └── package.json
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### 1. Clone the repository

```bash
git clone https://github.com/HarshitOnClouds/realtime-collaborative-draw-game.git
cd realtime-collaborative-draw-game
```

### 2. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Start the servers

Open **two terminals**:

```bash
# Terminal 1 — Backend (runs on port 4000)
cd backend
node index.js
```

```bash
# Terminal 2 — Frontend (runs on port 3000)
cd frontend
npm run dev
```

### 4. Play!

Open [http://localhost:3000](http://localhost:3000) in your browser. Open a second tab/browser to test multiplayer.

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Backend server port |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:4000` | Socket.IO server URL used by the frontend |

---

## 🎮 How to Play

1. **Enter your name** on the home screen
2. **Create or join a room**:
   - 🎲 **Quick Play** — queue up for auto-matchmaking
   - 🌐 **Public Rooms** — browse and join open lobbies
   - 🔒 **Private Room** — create one and share the 6-character code
3. **Host starts the game** — a random prompt appears and the timer begins
4. **Draw together** on the shared canvas using the toolbar
5. **Chat & react** while drawing
6. When time's up, **watch the replay** of how the drawing was created
7. Host can click **Play Again** to start a new round!


## 📄 License

This project is licensed under the MIT License.

# 🎨 DrawWithMe

A real-time collaborative drawing game inspired by Gartic Phone. Draw with friends on a shared canvas, chat, react, and even voice chat — all in real time.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socket.io&logoColor=white)
![PeerJS](https://img.shields.io/badge/PeerJS-orange?style=flat)

---

## ✨ Features

### 🖌️ Drawing Tools
- **Brush** — freehand drawing with adjustable size & color
- **Eraser** — erase parts of the canvas
- **Shapes** — rectangle, circle, and line tools with live preview
- **Text** — click anywhere on the canvas to place text
- **Color Picker** — preset palette + custom color input
- **Undo / Redo** — per-user stroke history with `Ctrl+Z` / `Ctrl+Y` support

### 🌐 Real-Time Collaboration
- **Live cursors** — see where other players are drawing in real time
- **Conflict-free syncing** — server-authoritative append-only event log
- **Instant broadcast** — all draw events are relayed via WebSocket with minimal latency
- **Player presence** — join/leave indicators and connection status

### 🎮 Game Mechanics
- **Prompt system** — random drawing prompts assigned each round
- **Configurable timer** — host picks round duration (30s, 60s, 90s, 2m, 5m)
- **Server-authoritative timer** — all players see the same countdown
- **Drawing replay** — after the round ends, watch a full replay of the drawing at adjustable speed (0.5x – 4x)
- **Spectator mode** — join a room as a spectator to watch without drawing

### 🏠 Room System
- **Private rooms** — create a room and share the 6-character code
- **Public rooms** — browse and join open lobbies
- **Quick Play matchmaking** — queue up and get auto-matched with other players
- **Host controls** — start game, clear canvas, restart rounds

### 💬 Communication
- **Text chat** — in-room chat with colored usernames
- **Voice chat** — peer-to-peer audio via PeerJS/WebRTC
- **Emoji reactions** — send floating reactions (👍 ❤️ 😂 🔥 🎉) that animate across the canvas

### 📦 Other
- **Export as PNG** — save the canvas as an image
- **Keyboard shortcuts** — `B` brush, `E` eraser, `T` text, `Ctrl+Z` undo, `Ctrl+Shift+Z` / `Ctrl+Y` redo

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | [Next.js 16](https://nextjs.org/) (React 19) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) |
| **State** | [Zustand](https://github.com/pmndrs/zustand) |
| **Real-time** | [Socket.IO](https://socket.io/) (client + server) |
| **Voice** | [PeerJS](https://peerjs.com/) / WebRTC |
| **Backend** | [Express 5](https://expressjs.com/) + Node.js |

---

## 📁 Project Structure

```
realtime-collaborative-draw-game/
├── backend/
│   ├── index.js            # Express + Socket.IO + PeerJS server
│   ├── package.json
│   └── types/              # JSDoc type definitions
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.js             # Home — lobby, matchmaking, room join
│   │   │   ├── room/[code]/page.js # Room — canvas, tools, chat, players
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── Canvas.js           # Main drawing canvas + overlays
│   │   │   ├── ReplayCanvas.js     # Post-game drawing replay
│   │   │   └── VoiceChat.js        # PeerJS voice chat
│   │   ├── lib/
│   │   │   └── socket.js           # Socket.IO client singleton
│   │   └── store/
│   │       └── useStore.js         # Zustand global state
│   └── package.json
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### 1. Clone the repository

```bash
git clone https://github.com/HarshitOnClouds/realtime-collaborative-draw-game.git
cd realtime-collaborative-draw-game
```

### 2. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Start the servers

Open **two terminals**:

```bash
# Terminal 1 — Backend (runs on port 4000)
cd backend
node index.js
```

```bash
# Terminal 2 — Frontend (runs on port 3000)
cd frontend
npm run dev
```

### 4. Play!

Open [http://localhost:3000](http://localhost:3000) in your browser. Open a second tab/browser to test multiplayer.

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Backend server port |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:4000` | Socket.IO server URL used by the frontend |

---

## 🎮 How to Play

1. **Enter your name** on the home screen
2. **Create or join a room**:
   - 🎲 **Quick Play** — queue up for auto-matchmaking
   - 🌐 **Public Rooms** — browse and join open lobbies
   - 🔒 **Private Room** — create one and share the 6-character code
3. **Host starts the game** — a random prompt appears and the timer begins
4. **Draw together** on the shared canvas using the toolbar
5. **Chat & react** while drawing
6. When time's up, **watch the replay** of how the drawing was created
7. Host can click **Play Again** to start a new round!


## 📄 License

This project is licensed under the MIT License.
