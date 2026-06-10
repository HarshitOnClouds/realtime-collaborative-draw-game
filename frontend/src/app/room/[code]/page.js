'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { socket } from '../../../lib/socket';
import { useStore } from '../../../store/useStore';
import Canvas from '../../../components/Canvas';
import ReplayCanvas from '../../../components/ReplayCanvas';
import dynamic from 'next/dynamic';

const VoiceChat = dynamic(() => import('../../../components/VoiceChat'), { ssr: false });

export default function Room() {
  const router = useRouter();
  const player = useStore(state => state.player);
  const room = useStore(state => state.room);
  const timer = useStore(state => state.timer);
  const { color, brushSize, tool, setColor, setBrushSize, setTool } = useStore();
  const updateRoom = useStore(state => state.updateRoom);
  const setTimer = useStore(state => state.setTimer);
  const [selectedTime, setSelectedTime] = useState(60);

  // Replay states
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!socket.connected || !room) {
      router.push('/');
      return;
    }

    const handlePlayerJoined = ({ player }) => {
      updateRoom({ players: [...(useStore.getState().room?.players || []), player] });
    };

    const handlePlayerLeft = ({ playerId }) => {
      const players = useStore.getState().room?.players || [];
      updateRoom({ players: players.map(p => p.id === playerId ? { ...p, isConnected: false } : p) });
    };

    const handleGameStart = ({ prompt }) => {
      updateRoom({ status: 'drawing', prompt });
      setTimer(room.timerDuration);
    };

    const handleGameTimer = ({ remaining }) => {
      setTimer(remaining);
    };

    const handleGameEnd = () => {
      updateRoom({ status: 'ended' });
      setTimer(0);
    };

    const handleRoomState = ({ room: updatedRoom }) => {
      updateRoom(updatedRoom);
      if (updatedRoom.status === 'waiting') {
        setIsPlaying(true);
        setSpeed(1);
      }
    };

    const handleChatMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    socket.on('room:player_joined', handlePlayerJoined);
    socket.on('room:player_left', handlePlayerLeft);
    socket.on('game:start', handleGameStart);
    socket.on('game:timer', handleGameTimer);
    socket.on('game:end', handleGameEnd);
    socket.on('room:state', handleRoomState);
    socket.on('chat:message', handleChatMessage);

    return () => {
      socket.off('room:player_joined', handlePlayerJoined);
      socket.off('room:player_left', handlePlayerLeft);
      socket.off('game:start', handleGameStart);
      socket.off('game:timer', handleGameTimer);
      socket.off('game:end', handleGameEnd);
      socket.off('room:state', handleRoomState);
      socket.off('chat:message', handleChatMessage);
    };
  }, [router, room]);

  if (!room) return <div className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center">Loading...</div>;

  const startGame = () => {
    socket.emit('game:start', { timerDuration: selectedTime });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    alert('Code copied!');
  };

  const exportCanvas = () => {
    const canvas = document.getElementById('drawing-board');
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `draw-together-${room.code}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !player) return;
    const msg = { text: chatInput, name: player.name, color: player.color };
    setMessages(prev => [...prev, msg]);
    socket.emit('chat:message', msg);
    setChatInput('');
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#0d0d0d] text-white font-inter flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-[#1a1a1a] border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-[#6ee7b7]">DRAW TOGETHER</h1>
          <VoiceChat />
          <div className="hidden sm:flex bg-black px-3 py-1 rounded-md border border-gray-700 items-center gap-2 cursor-pointer" onClick={copyCode}>
            <span className="text-gray-400 text-xs uppercase">Room</span>
            <span className="font-mono text-sm tracking-widest">{room.code}</span>
          </div>
        </div>
        
        {room.status === 'drawing' && (
          <div className="text-center absolute left-1/2 -translate-x-1/2 hidden md:block">
            <div className="text-gray-400 text-[10px] uppercase mb-1">Prompt</div>
            <div className="font-mono text-lg">{room.prompt}</div>
          </div>
        )}
        
        <div className={`font-mono text-2xl sm:text-3xl font-bold ${timer !== null && timer <= 10 ? 'text-red-500' : 'text-white'}`}>
          {timer !== null ? `${Math.floor(timer / 60)}:${(timer % 60).toString().padStart(2, '0')}` : '00:00'}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-0">
        {/* Canvas Area */}
        <div className="w-full lg:flex-[7] p-4 lg:p-6 flex flex-col items-center justify-center bg-[#0d0d0d] min-h-[50vh] lg:min-h-0 lg:overflow-hidden">
          {room.status === 'ended' ? (
            <ReplayCanvas room={room} isPlaying={isPlaying} speed={speed} />
          ) : (
            <Canvas room={room} />
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:flex-[3] bg-[#1a1a1a] border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col lg:overflow-hidden min-h-0">
          
          {/* Players */}
          <div className="p-4 lg:p-4 border-b border-gray-800 shrink-0 lg:max-h-[25vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-gray-400 text-xs uppercase mb-3 font-bold tracking-wider flex justify-between">
              <span>Players</span>
              <span>{room.players.filter(p => p.isConnected).length}</span>
            </h3>
            <div className="flex flex-col gap-2">
              {room.players.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-black/30 p-2 rounded-lg border border-gray-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center font-bold text-black text-xs" style={{ backgroundColor: p.color, borderColor: p.isConnected ? '#6ee7b7' : 'gray' }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className={`font-medium text-xs ${!p.isConnected ? 'text-gray-500 line-through' : 'text-white'}`}>
                        {p.name} {p.id === room.hostId && '(Host)'} {p.id === player?.id && '(You)'}
                      </span>
                      {!p.isConnected && <span className="text-[10px] text-red-400">Disconnected</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {room.status === 'waiting' && room.hostId === player?.id && (
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex justify-between items-center bg-gray-800 rounded-lg p-2">
                  <span className="text-xs text-gray-300">Round Duration</span>
                  <select 
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(Number(e.target.value))}
                    className="bg-[#0d0d0d] text-white border border-gray-600 rounded px-2 py-1 text-xs outline-none focus:border-[#6ee7b7]"
                  >
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                    <option value={90}>90s</option>
                    <option value={120}>120s</option>
                    <option value={300}>5m</option>
                  </select>
                </div>
                <button 
                  onClick={startGame}
                  className="w-full bg-[#6ee7b7] text-black font-bold py-2 px-4 rounded-lg hover:bg-[#5cd6a6] transition-colors shadow-[0_0_15px_rgba(110,231,183,0.3)] text-sm"
                >
                  Start Game
                </button>
              </div>
            )}
          </div>

          {/* Tools or Replay Controls */}
          <div className="p-4 lg:p-4 border-b border-gray-800 shrink-0 lg:shrink lg:overflow-y-auto custom-scrollbar">
            {room.status === 'ended' ? (
              <>
                <h3 className="text-gray-400 text-xs uppercase mb-4 font-bold tracking-wider">Replay Controls</h3>
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-full bg-[#6ee7b7] text-black font-bold py-3 px-4 rounded-lg hover:bg-[#5cd6a6] transition-colors shadow-[0_0_15px_rgba(110,231,183,0.3)]"
                  >
                    {isPlaying ? 'Pause Replay' : 'Play Replay'}
                  </button>
                  <div className="flex justify-between items-center bg-gray-800 rounded-lg p-3">
                    <span className="text-sm text-gray-300">Playback Speed</span>
                    <select 
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                      className="bg-[#0d0d0d] text-white border border-gray-600 rounded px-2 py-1 text-sm outline-none focus:border-[#6ee7b7]"
                    >
                      <option value={0.5}>0.5x</option>
                      <option value={1}>1x Normal</option>
                      <option value={2}>2x Fast</option>
                      <option value={4}>4x Very Fast</option>
                    </select>
                  </div>
                  {room.hostId === player?.id && (
                    <button 
                      onClick={() => socket.emit('game:restart')}
                      className="w-full mt-2 bg-gray-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Play Again
                    </button>
                  )}
                </div>
              </>
            ) : player?.isSpectator ? (
              <div className="flex flex-col items-center justify-center p-6 bg-black/40 rounded-lg border border-gray-800">
                <span className="text-4xl mb-3">👁️</span>
                <h4 className="text-[#6ee7b7] font-bold text-lg mb-1">Spectator Mode</h4>
                <p className="text-gray-400 text-sm text-center">You are watching the game. You cannot draw, but you can use the chat!</p>
              </div>
            ) : (
              <>
                <h3 className="text-gray-400 text-xs uppercase mb-4 font-bold tracking-wider">Tools</h3>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setTool('brush')}
                        className={`flex-1 py-1 px-2 rounded-md font-medium text-xs transition-colors ${tool === 'brush' ? 'bg-[#6ee7b7] text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                      >
                        Brush
                      </button>
                      <button 
                        onClick={() => setTool('eraser')}
                        className={`flex-1 py-1 px-2 rounded-md font-medium text-xs transition-colors ${tool === 'eraser' ? 'bg-[#6ee7b7] text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                      >
                        Eraser
                      </button>
                      <button 
                        onClick={() => setTool('text')}
                        className={`flex-1 py-1 px-2 rounded-md font-medium text-xs transition-colors ${tool === 'text' ? 'bg-[#6ee7b7] text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                      >
                        Text
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setTool('rect')}
                        className={`flex-1 py-1 px-2 rounded-md font-medium text-xs transition-colors ${tool === 'rect' ? 'bg-[#6ee7b7] text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                      >
                        Rect
                      </button>
                      <button 
                        onClick={() => setTool('circle')}
                        className={`flex-1 py-1 px-2 rounded-md font-medium text-xs transition-colors ${tool === 'circle' ? 'bg-[#6ee7b7] text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                      >
                        Circle
                      </button>
                      <button 
                        onClick={() => setTool('line')}
                        className={`flex-1 py-1 px-2 rounded-md font-medium text-xs transition-colors ${tool === 'line' ? 'bg-[#6ee7b7] text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                      >
                        Line
                      </button>
                    </div>
                  </div>

                  {(tool === 'brush' || tool === 'text' || tool === 'rect' || tool === 'circle' || tool === 'line') && (
                    <div>
                      <div className="flex gap-2 mb-2 flex-wrap items-center">
                        {['#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'].map(c => (
                          <button
                            key={c}
                            onClick={() => setColor(c)}
                            className={`w-8 h-8 shrink-0 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-110' : 'border-gray-600 hover:border-gray-400'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden relative border-2 border-dashed border-gray-500 hover:border-white transition-colors cursor-pointer" title="Custom Color">
                          <input 
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Size</span>
                      <span>{brushSize}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" max="50" 
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                      className="w-full accent-[#6ee7b7]"
                    />
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={() => window.dispatchEvent(new Event('trigger-undo'))}
                      className="flex-1 py-2 rounded-md font-medium bg-gray-800 text-white hover:bg-gray-700 transition-colors border border-gray-700"
                    >
                      Undo
                    </button>
                    <button 
                      onClick={() => window.dispatchEvent(new Event('trigger-redo'))}
                      className="flex-1 py-2 rounded-md font-medium bg-gray-800 text-white hover:bg-gray-700 transition-colors border border-gray-700"
                    >
                      Redo
                    </button>
                  </div>

                  <button 
                    onClick={exportCanvas}
                    className="w-full py-2 mt-2 rounded-md font-medium bg-gray-800 text-[#6ee7b7] hover:bg-gray-700 transition-colors border border-[#6ee7b7]/30"
                  >
                    Save as Image
                  </button>

                  {room.hostId === player?.id && (
                    <button 
                      onClick={() => {
                        if(confirm('Are you sure you want to clear the canvas?')) {
                          socket.emit('draw:clear');
                        }
                      }}
                      className="w-full py-2 mt-2 rounded-md font-medium bg-red-900/40 text-red-400 hover:bg-red-900/80 transition-colors border border-red-800/50"
                    >
                      Clear Canvas
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Reactions */}
          <div className="bg-[#1a1a1a] py-2 px-4 flex justify-center gap-4 border-t border-gray-800 shrink-0">
            {['👍', '❤️', '😂', '🔥', '🎉'].map(emoji => (
              <button 
                key={emoji}
                onClick={() => {
                  const reaction = { emoji, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() };
                  socket.emit('room:reaction', reaction);
                  window.dispatchEvent(new CustomEvent('local-reaction', { detail: reaction }));
                }}
                className="text-2xl hover:scale-125 hover:-translate-y-1 transition-all"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Chat Box */}
          <div className="bg-[#1a1a1a] p-4 flex flex-col flex-1 min-h-[300px] max-h-[400px] lg:max-h-none lg:min-h-[35vh] overflow-hidden border-t border-gray-800">
            <h3 className="text-gray-400 text-xs uppercase mb-4 font-bold tracking-wider">Chat</h3>
            <div className="flex-1 overflow-y-auto mb-4 space-y-2 pr-2 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="text-gray-600 text-xs italic">No messages yet.</div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-bold mr-2" style={{ color: m.color }}>{m.name}:</span>
                    <span className="text-gray-300">{m.text}</span>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendChat} className="flex gap-2">
              <input 
                type="text" 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)} 
                placeholder="Type a message..."
                className="flex-1 bg-black border border-gray-700 rounded px-3 py-2 text-sm outline-none focus:border-[#6ee7b7]"
              />
              <button type="submit" className="bg-[#6ee7b7] text-black px-4 py-2 rounded font-bold text-sm hover:bg-[#5cd6a6]">Send</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
