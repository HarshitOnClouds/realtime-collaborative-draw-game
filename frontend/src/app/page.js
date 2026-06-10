'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { socket } from '../lib/socket';
import { useStore } from '../store/useStore';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState('matchmaking'); // 'matchmaking' or 'private'
  const [publicRooms, setPublicRooms] = useState([]);
  const [inQueue, setInQueue] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  const router = useRouter();
  const setRoom = useStore(state => state.setRoom);

  useEffect(() => {
    socket.connect();

    const handleRoomState = ({ room }) => {
      setRoom(room);
      const currentPlayer = room.players.find(p => p.id === socket.id);
      if (currentPlayer) {
        useStore.getState().setPlayer(currentPlayer);
      }
      router.push(`/room/${room.code}`);
    };

    const handleError = ({ message }) => {
      setError(message);
    };

    socket.on('room:state', handleRoomState);
    socket.on('error', handleError);
    socket.on('matchmaking:public_rooms', (rooms) => setPublicRooms(rooms));
    socket.on('matchmaking:queue_update', ({ count }) => setQueueCount(count));

    // Request public rooms on mount
    socket.emit('matchmaking:get_public_rooms');
    const interval = setInterval(() => {
      socket.emit('matchmaking:get_public_rooms');
    }, 3000);

    return () => {
      socket.off('room:state', handleRoomState);
      socket.off('error', handleError);
      socket.off('matchmaking:public_rooms');
      socket.off('matchmaking:queue_update');
      clearInterval(interval);
    };
  }, [router, setRoom]);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    setError('');
    socket.emit('room:create', { playerName, isPublic: false });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim() || !roomCode.trim()) {
      setError('Please enter your name and room code');
      return;
    }
    setError('');
    socket.emit('room:join', { code: roomCode, playerName, isSpectator });
  };

  const handleJoinPublic = (code) => {
    if (!playerName.trim()) {
      setError('Please enter your name before joining');
      return;
    }
    socket.emit('room:join', { code, playerName, isSpectator: false });
  };

  const toggleQueue = () => {
    if (!playerName.trim()) {
      setError('Please enter your name first');
      return;
    }
    if (inQueue) {
      socket.emit('matchmaking:queue_leave');
      setInQueue(false);
    } else {
      socket.emit('matchmaking:queue_join', { playerName });
      setInQueue(true);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 lg:p-24 bg-[#0d0d0d] text-white font-inter">
      <div className="z-10 max-w-xl w-full items-center justify-between font-mono text-sm lg:flex flex-col gap-8">
        <h1 className="text-4xl font-bold text-[#6ee7b7] mb-4 tracking-wider text-center">
          DRAW TOGETHER
        </h1>
        
        <div className="bg-[#1a1a1a] p-8 rounded-xl shadow-2xl w-full border border-gray-800">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">Your Name</label>
            <input 
              type="text" 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-[#0d0d0d] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#6ee7b7] transition-colors"
              placeholder="Enter your name"
              maxLength={20}
              disabled={inQueue}
            />
          </div>

          {/* TABS */}
          <div className="flex gap-2 mb-6 p-1 bg-black rounded-lg">
            <button 
              onClick={() => setActiveTab('matchmaking')}
              className={`flex-1 py-2 text-center rounded-md font-bold transition-colors ${activeTab === 'matchmaking' ? 'bg-[#6ee7b7] text-black' : 'text-gray-500 hover:text-white'}`}
            >
              Play Online
            </button>
            <button 
              onClick={() => setActiveTab('private')}
              className={`flex-1 py-2 text-center rounded-md font-bold transition-colors ${activeTab === 'private' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              Private Room
            </button>
          </div>

          {error && (
            <div className="mb-4 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {activeTab === 'matchmaking' ? (
            <div className="flex flex-col gap-6">
              <button 
                onClick={toggleQueue}
                className={`w-full font-bold py-4 px-4 rounded-lg transition-all shadow-[0_0_15px_rgba(110,231,183,0.3)] ${
                  inQueue 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-[#6ee7b7] text-black hover:bg-[#5cd6a6]'
                }`}
              >
                {inQueue ? `Waiting in Queue... (${queueCount}/2) - Click to Cancel` : 'Find Match (Quick Play)'}
              </button>

              <div className="mt-4">
                <h3 className="text-gray-400 text-xs uppercase mb-3 font-bold tracking-wider">Public Rooms</h3>
                {publicRooms.length === 0 ? (
                  <p className="text-sm text-gray-600 italic">No public rooms currently waiting...</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {publicRooms.map(room => (
                      <div key={room.code} className="flex justify-between items-center bg-black p-3 rounded-md border border-gray-800 hover:border-[#6ee7b7] transition-colors">
                        <div>
                          <div className="text-[#6ee7b7] font-bold">Room {room.code}</div>
                          <div className="text-xs text-gray-500">Host: {room.hostName} • Players: {room.playerCount}/8</div>
                        </div>
                        <button 
                          onClick={() => handleJoinPublic(room.code)}
                          className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-bold"
                          disabled={inQueue}
                        >
                          Join
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <button 
                onClick={handleCreateRoom}
                className="w-full bg-gray-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors"
                disabled={inQueue}
              >
                Create Private Room
              </button>

              <div className="relative flex items-center">
                <div className="flex-grow border-t border-gray-800"></div>
                <span className="flex-shrink-0 mx-4 text-gray-600 text-sm">OR JOIN WITH CODE</span>
                <div className="flex-grow border-t border-gray-800"></div>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-[#0d0d0d] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#6ee7b7] uppercase tracking-widest font-mono"
                  placeholder="CODE"
                  maxLength={6}
                  disabled={inQueue}
                />
                <button 
                  onClick={handleJoinRoom}
                  className="bg-gray-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-600 transition-colors"
                  disabled={inQueue}
                >
                  Join
                </button>
              </div>

              <div className="flex items-center gap-2 px-1">
                <input 
                  type="checkbox" 
                  id="spectator"
                  checked={isSpectator}
                  onChange={(e) => setIsSpectator(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-700 bg-[#0d0d0d] text-[#6ee7b7]"
                  disabled={inQueue}
                />
                <label htmlFor="spectator" className="text-sm text-gray-400 cursor-pointer">
                  Join as Spectator (No Drawing)
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
