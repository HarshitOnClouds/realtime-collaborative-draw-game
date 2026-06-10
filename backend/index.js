const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');

const PROMPTS = [
  'Draw a majestic space cat',
  'A cyberpunk hotdog stand',
  'A dragon reading a newspaper',
  'A ninja turtle eating pizza',
  'The Eiffel Tower on Mars',
  'A wizard skateboarding',
  'A robot trying to paint',
  'A time-traveling dinosaur',
  'An alien abduction of a cow',
  'A samurai cutting a watermelon'
];

const app = express();
const server = http.createServer(app);

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Setup PeerJS Server
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/',
});
app.use('/peerjs', peerServer);

/** @type {Map<string, import('./types/shared.js').Room>} */
const rooms = new Map();

/** @type {Array<{socket: import('socket.io').Socket, playerName: string}>} */
const matchmakingQueue = [];

/**
 * Generate a random 6-character room code.
 * @returns {string}
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('room:create', ({ playerName, isPublic = false }) => {
    try {
      const code = generateRoomCode();
      const roomId = `room_${code}`;

      /** @type {import('./types/shared.js').Player} */
      const host = {
        id: socket.id,
        name: playerName,
        peerId: '', // Client will update later
        color: '#6ee7b7', // Default color, can be randomized
        isConnected: true,
      };

      /** @type {import('./types/shared.js').Room} */
      const newRoom = {
        id: roomId,
        code,
        hostId: socket.id,
        players: [host],
        status: 'waiting',
        prompt: '',
        drawEvents: [],
        timerDuration: 300, // 5 minutes
        createdAt: Date.now(),
        isPublic: isPublic,
      };

      rooms.set(roomId, newRoom);
      socket.join(roomId);
      socket.data.roomId = roomId;

      socket.emit('room:state', { room: newRoom });
    } catch (err) {
      socket.emit('error', { code: 'CREATE_ERROR', message: 'Failed to create room' });
    }
  });

  socket.on('room:join', ({ code, playerName, isSpectator }) => {
    try {
      const roomId = `room_${code.toUpperCase()}`;
      const room = rooms.get(roomId);

      if (!room) {
        return socket.emit('error', { code: 'NOT_FOUND', message: 'Room not found' });
      }
      
      if (room.status !== 'waiting') {
        return socket.emit('error', { code: 'NOT_WAITING', message: 'Room is already in session' });
      }

      /** @type {import('./types/shared.js').Player} */
      const player = {
        id: socket.id,
        name: playerName,
        peerId: '', // Client will update later
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`, // Random hex color
        isConnected: true,
        isSpectator: isSpectator || false,
      };

      room.players.push(player);
      socket.join(roomId);
      socket.data.roomId = roomId;

      // SYNC: Notify others in the room
      socket.to(roomId).emit('room:player_joined', { player });
      
      // SYNC: Send full state to the newly joined player
      socket.emit('room:state', { room });
    } catch (err) {
      socket.emit('error', { code: 'JOIN_ERROR', message: 'Failed to join room' });
    }
  });

  socket.on('room:leave', () => {
    handlePlayerDisconnect(socket);
  });

  socket.on('draw:event', ({ event }) => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;

      const room = rooms.get(roomId);
      if (room && room.status === 'drawing') {
        if (event.type === 'undo') {
          // Find the last strokeId belonging to this user
          const userEvents = room.drawEvents.filter(e => e.userId === event.userId);
          if (userEvents.length > 0) {
            const lastStrokeId = userEvents[userEvents.length - 1].strokeId;
            // Remove all events with this strokeId
            room.drawEvents = room.drawEvents.filter(e => e.strokeId !== lastStrokeId);
          }
        } else {
          // SYNC: Server-authoritative append-only event log
          room.drawEvents.push(event);
        }
        
        // SYNC: Broadcast to everyone
        socket.to(roomId).emit('draw:event', { event });
      }
    } catch (err) {
      console.error('Error handling draw event', err);
    }
  });

  // Handle Redo Event
  socket.on('draw:redo', ({ events }) => {
    try {
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (!room || !events || !events.length) return;
      
      // Add the redone events back to the room
      room.drawEvents.push(...events);
      
      // Emit to others in the room
      socket.to(roomId).emit('draw:redo', { events });
    } catch (err) {
      console.error('Error handling draw redo', err);
    }
  });

  // Handle Cursors
  socket.on('cursor:move', (data) => {
    const roomId = socket.data.roomId;
    if (roomId) {
      socket.to(roomId).emit('cursor:move', { userId: socket.id, ...data });
    }
  });

  socket.on('cursor:leave', () => {
    const roomId = socket.data.roomId;
    if (roomId) {
      socket.to(roomId).emit('cursor:leave', { userId: socket.id });
    }
  });

  // Handle Chat
  socket.on('chat:message', (msg) => {
    const roomId = socket.data.roomId;
    if (roomId) {
      socket.to(roomId).emit('chat:message', msg);
    }
  });

  // Handle Reactions
  socket.on('room:reaction', (reaction) => {
    const roomId = socket.data.roomId;
    if (roomId) {
      socket.to(roomId).emit('room:reaction', reaction);
    }
  });

  // Handle Voice Registration
  socket.on('voice:register', ({ peerId }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.peerId = peerId;
      io.to(roomId).emit('room:state', { room });
    }
  });

  // Handle Clear Canvas
  socket.on('draw:clear', () => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      
      const room = rooms.get(roomId);
      if (!room || room.hostId !== socket.id) return;

      room.drawEvents = [];
      io.to(roomId).emit('draw:clear');
    } catch (err) {
      console.error('Error clearing canvas', err);
    }
  });

  // Handle clear all events (development utility)
  socket.on('dev:clear_events', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.drawEvents = [];
    io.to(roomId).emit('room:state', { room });
    io.to(roomId).emit('draw:clear');
  });

  // --- MATCHMAKING & PUBLIC ROOMS ---
  
  socket.on('matchmaking:get_public_rooms', () => {
    const publicRooms = [];
    for (const [id, room] of rooms.entries()) {
      if (room.isPublic && room.status === 'waiting') {
        publicRooms.push({
          code: room.code,
          hostName: room.players.find(p => p.id === room.hostId)?.name || 'Unknown',
          playerCount: room.players.length,
          createdAt: room.createdAt
        });
      }
    }
    socket.emit('matchmaking:public_rooms', publicRooms);
  });

  socket.on('matchmaking:queue_join', ({ playerName }) => {
    matchmakingQueue.push({ socket, playerName });
    socket.emit('matchmaking:queue_update', { count: matchmakingQueue.length });
    
    // Check if we have enough players to form a match (e.g. 2 for now to test)
    if (matchmakingQueue.length >= 2) {
      const players = matchmakingQueue.splice(0, 2);
      
      // First player becomes host
      const host = players[0];
      const code = generateRoomCode();
      const roomId = `room_${code}`;

      const hostPlayer = {
        id: host.socket.id,
        name: host.playerName,
        peerId: '',
        color: '#6ee7b7',
        isConnected: true,
      };

      const newRoom = {
        id: roomId,
        code,
        hostId: host.socket.id,
        players: [hostPlayer],
        status: 'waiting',
        prompt: '',
        drawEvents: [],
        timerDuration: 300,
        createdAt: Date.now(),
        isPublic: true, // Queue matches are inherently public
      };

      rooms.set(roomId, newRoom);

      players.forEach((p, idx) => {
        const pPlayer = {
          id: p.socket.id,
          name: p.playerName,
          peerId: '',
          color: idx === 0 ? '#6ee7b7' : '#ec4899', // Assign different colors
          isConnected: true,
        };
        if (idx !== 0) newRoom.players.push(pPlayer);
        
        p.socket.join(roomId);
        p.socket.data.roomId = roomId;
        p.socket.emit('matchmaking:found', { code, role: idx === 0 ? 'host' : 'guest' });
        p.socket.emit('room:state', { room: newRoom });
      });
    } else {
      // Broadcast to queue that someone joined
      matchmakingQueue.forEach(p => {
        p.socket.emit('matchmaking:queue_update', { count: matchmakingQueue.length });
      });
    }
  });

  socket.on('matchmaking:queue_leave', () => {
    const index = matchmakingQueue.findIndex(q => q.socket.id === socket.id);
    if (index !== -1) {
      matchmakingQueue.splice(index, 1);
      matchmakingQueue.forEach(p => {
        p.socket.emit('matchmaking:queue_update', { count: matchmakingQueue.length });
      });
    }
  });

  // Handle Game Timer and Start
  socket.on('game:start', (data = {}) => {
    try {
      const { timerDuration } = data;
      const roomId = socket.data.roomId;
      if (!roomId) return;
      
      const room = rooms.get(roomId);
      if (!room) return;

      // Only host can start
      if (room.hostId !== socket.id) return;

      room.status = 'drawing';
      room.prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
      
      if (timerDuration && typeof timerDuration === 'number') {
        room.timerDuration = timerDuration;
      }
      
      // SYNC: Broadcast start to everyone
      io.to(roomId).emit('game:start', { prompt: room.prompt });

      // Start authoritative timer
      let remaining = room.timerDuration;
      
      const timerInterval = setInterval(() => {
        remaining -= 1;
        
        // SYNC: Server emits timer every second
        io.to(roomId).emit('game:timer', { remaining });

        if (remaining <= 0) {
          clearInterval(timerInterval);
          room.status = 'ended';
          io.to(roomId).emit('game:end');
        }
      }, 1000);
      
      // Save interval ID to clear it later if room is empty
      room.timerInterval = timerInterval;
    } catch (err) {
      socket.emit('error', { code: 'START_ERROR', message: 'Failed to start game' });
    }
  });

  socket.on('game:restart', () => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      
      const room = rooms.get(roomId);
      if (!room || room.hostId !== socket.id) return;
      
      room.status = 'waiting';
      room.drawEvents = [];
      
      // Broadcast updated state to everyone
      io.to(roomId).emit('room:state', { room });
    } catch (err) {
      console.error('Error handling game restart', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from queue if in it
    const queueIndex = matchmakingQueue.findIndex(q => q.socket.id === socket.id);
    if (queueIndex !== -1) {
      matchmakingQueue.splice(queueIndex, 1);
      matchmakingQueue.forEach(p => {
        p.socket.emit('matchmaking:queue_update', { count: matchmakingQueue.length });
      });
    }

    handlePlayerDisconnect(socket);
  });

  function handlePlayerDisconnect(socket) {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;

      const room = rooms.get(roomId);
      if (room) {
        // Mark player as disconnected
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          player.isConnected = false;
        }
        
        // SYNC: Notify others
        socket.to(roomId).emit('room:player_left', { playerId: socket.id });
        socket.leave(roomId);
        socket.data.roomId = null;

        // Cleanup empty rooms
        const hasConnectedPlayers = room.players.some(p => p.isConnected);
        if (!hasConnectedPlayers) {
          if (room.timerInterval) clearInterval(room.timerInterval);
          rooms.delete(roomId);
        }
      }
    } catch (err) {
      console.error('Error handling disconnect', err);
    }
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
