import { create } from 'zustand';

export const useStore = create((set) => ({
  // Player state
  player: null, // { id, name, peerId, color, isConnected }
  
  // Room state
  room: null, // { id, code, hostId, players, status, prompt, drawEvents, timerDuration, createdAt }
  timer: null, // Remaining time in seconds

  // Local drawing state
  color: '#ffffff',
  brushSize: 5,
  tool: 'brush', // 'brush' or 'eraser'

  // Actions
  setPlayer: (player) => set({ player }),
  setRoom: (room) => set({ room }),
  updateRoom: (updates) => set((state) => ({ room: { ...state.room, ...updates } })),
  setTimer: (timer) => set({ timer }),
  
  setColor: (color) => set({ color }),
  setBrushSize: (brushSize) => set({ brushSize }),
  setTool: (tool) => set({ tool }),
}));
