'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { socket } from '../lib/socket';

export default function Canvas({ room }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStrokeId, setCurrentStrokeId] = useState('');
  const [remoteCursors, setRemoteCursors] = useState({});
  const [textInput, setTextInput] = useState(null);
  const [reactions, setReactions] = useState([]);
  
  const { color, brushSize, tool } = useStore();
  const player = useStore(state => state.player);

  useEffect(() => {
    const redrawAll = (events) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      lastCoordsRef.current = {}; // reset tracking
      events.forEach(applyDrawEvent);
    };

    // SYNC: When socket gets a draw event from server
    const handleDrawEvent = ({ event }) => {
      if (event.type === 'undo') {
        const room = useStore.getState().room;
        if (!room) return;
        
        const userEvents = room.drawEvents.filter(e => e.userId === event.userId);
        if (userEvents.length > 0) {
          const lastStrokeId = userEvents[userEvents.length - 1].strokeId;
          const newEvents = room.drawEvents.filter(e => e.strokeId !== lastStrokeId);
          useStore.getState().updateRoom({ drawEvents: newEvents });
          redrawAll(newEvents);
        }
      } else if (event.userId !== player?.id) {
        applyDrawEvent(event);
        
        // Add to local room state immediately for resize re-rendering
        useStore.getState().updateRoom({
          drawEvents: [...(useStore.getState().room?.drawEvents || []), event]
        });
      }
    };

    // Listen to local custom event for our own undo
    const handleLocalUndo = () => {
      const room = useStore.getState().room;
      if (!room || !player) return;
      
      const userEvents = room.drawEvents.filter(e => e.userId === player.id);
      if (userEvents.length > 0) {
        const lastStrokeId = userEvents[userEvents.length - 1].strokeId;
        const undoneStrokes = room.drawEvents.filter(e => e.strokeId === lastStrokeId);
        const newEvents = room.drawEvents.filter(e => e.strokeId !== lastStrokeId);
        
        redoStackRef.current.push(undoneStrokes);
        
        useStore.getState().updateRoom({ drawEvents: newEvents });
        redrawAll(newEvents);
        
        // Emit to server
        socket.emit('draw:event', { event: { type: 'undo', userId: player.id } });
      }
    };

    const handleLocalRedo = () => {
      const room = useStore.getState().room;
      if (!room || !player) return;
      
      const redoStrokes = redoStackRef.current.pop();
      if (redoStrokes && redoStrokes.length > 0) {
        redoStrokes.forEach(applyDrawEvent);
        useStore.getState().updateRoom({
          drawEvents: [...(useStore.getState().room?.drawEvents || []), ...redoStrokes]
        });
        socket.emit('draw:redo', { events: redoStrokes });
      }
    };

    const handleDrawRedo = ({ events }) => {
      events.forEach(applyDrawEvent);
      useStore.getState().updateRoom({
        drawEvents: [...(useStore.getState().room?.drawEvents || []), ...events]
      });
    };

    const handleDrawClear = () => {
      const room = useStore.getState().room;
      if (!room) return;
      useStore.getState().updateRoom({ drawEvents: [] });
      redrawAll([]);
    };

    const handleCursorMove = ({ userId, x, y, isDrawing }) => {
      setRemoteCursors(prev => ({ ...prev, [userId]: { x, y, isDrawing } }));
    };

    const handleCursorLeave = ({ userId }) => {
      setRemoteCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
    };

    const handleReaction = (reaction) => {
      const startX = 10 + Math.random() * 80; // 10% to 90% across the bottom
      setReactions(prev => [...prev, { ...reaction, startX }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== reaction.id));
      }, 3000);
    };

    const localReactionHandler = (e) => handleReaction(e.detail);

    window.addEventListener('trigger-undo', handleLocalUndo);
    window.addEventListener('trigger-redo', handleLocalRedo);
    window.addEventListener('local-reaction', localReactionHandler);
    socket.on('draw:event', handleDrawEvent);
    socket.on('draw:redo', handleDrawRedo);
    socket.on('draw:clear', handleDrawClear);
    socket.on('cursor:move', handleCursorMove);
    socket.on('cursor:leave', handleCursorLeave);
    socket.on('room:reaction', handleReaction);

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key.toLowerCase() === 'b') {
        useStore.getState().setTool('brush');
      } else if (e.key.toLowerCase() === 'e') {
        useStore.getState().setTool('eraser');
      } else if (e.key.toLowerCase() === 't') {
        useStore.getState().setTool('text');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleLocalRedo();
        } else {
          handleLocalUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleLocalRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('trigger-undo', handleLocalUndo);
      window.removeEventListener('trigger-redo', handleLocalRedo);
      window.removeEventListener('local-reaction', localReactionHandler);
      socket.off('draw:event', handleDrawEvent);
      socket.off('draw:redo', handleDrawRedo);
      socket.off('draw:clear', handleDrawClear);
      socket.off('cursor:move', handleCursorMove);
      socket.off('cursor:leave', handleCursorLeave);
      socket.off('room:reaction', handleReaction);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [player]);

  useEffect(() => {
    // Setup canvases
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const ctx = canvas.getContext('2d');
    const overlayCtx = overlay.getContext('2d');
    
    // Set explicit size (16:9 ratio)
    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = width * (9 / 16);
    
    canvas.width = width;
    canvas.height = height;
    overlay.width = width;
    overlay.height = height;

    // Fill background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Initial render of all past events
    if (room && room.drawEvents) {
      // Re-render everything
      room.drawEvents.forEach(applyDrawEvent);
    }

    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = newWidth * (9 / 16);
      canvas.width = newWidth;
      canvas.height = newHeight;
      overlay.width = newWidth;
      overlay.height = newHeight;
      
      // Re-fill and redraw on resize
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, newWidth, newHeight);
      
      const currentRoom = useStore.getState().room;
      if (currentRoom && currentRoom.drawEvents) {
        currentRoom.drawEvents.forEach(applyDrawEvent);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getNormCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / canvas.width;
    const y = (e.clientY - rect.top) / canvas.height;
    return { x, y };
  };

  const lastCoordsRef = useRef({});
  const redoStackRef = useRef([]);

  const applyDrawEvent = (event) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const x = event.x * canvas.width;
    const y = event.y * canvas.height;

    if (event.type === 'stroke_start') {
      lastCoordsRef.current[event.strokeId] = { x, y };
    } else if (event.type === 'stroke_move') {
      const lastCoord = lastCoordsRef.current[event.strokeId];
      if (lastCoord) {
        ctx.beginPath();
        ctx.lineWidth = event.brushSize;
        ctx.strokeStyle = event.color;
        ctx.moveTo(lastCoord.x, lastCoord.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      lastCoordsRef.current[event.strokeId] = { x, y };
    } else if (event.type === 'stroke_end') {
      delete lastCoordsRef.current[event.strokeId];
    } else if (event.type === 'shape') {
      ctx.beginPath();
      ctx.lineWidth = event.brushSize;
      ctx.strokeStyle = event.color;
      
      const startX = event.startX * canvas.width;
      const startY = event.startY * canvas.height;
      const endX = event.endX * canvas.width;
      const endY = event.endY * canvas.height;

      if (event.shapeType === 'rect') {
        ctx.strokeRect(startX, startY, endX - startX, endY - startY);
      } else if (event.shapeType === 'circle') {
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (event.shapeType === 'line') {
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    } else if (event.type === 'text') {
      ctx.font = `bold ${event.brushSize * 2}px Inter, sans-serif`;
      ctx.fillStyle = event.color;
      ctx.fillText(event.text, x, y);
    }
  };

  const emitShapeEvent = (shapeType, startX, startY, endX, endY) => {
    if (!player || player.isSpectator) return;
    
    const event = {
      type: 'shape',
      shapeType,
      userId: player.id,
      startX, startY, endX, endY,
      color,
      brushSize,
      timestamp: Date.now(),
      strokeId: Math.random().toString(36).substring(2, 9),
    };

    applyDrawEvent(event);
    useStore.getState().updateRoom({
      drawEvents: [...(useStore.getState().room?.drawEvents || []), event]
    });
    socket.emit('draw:event', { event });
  };

  const emitDrawEvent = (type, x, y) => {
    if (!player || player.isSpectator) return;
    
    const event = {
      type,
      userId: player.id,
      x,
      y,
      color: tool === 'eraser' ? '#1a1a1a' : color,
      brushSize: tool === 'eraser' ? brushSize * 3 : brushSize,
      timestamp: Date.now(), // Server should ideally override this
      strokeId: currentStrokeId,
    };

    // Apply locally
    applyDrawEvent(event);
    
    // Add to local room state immediately for resize re-rendering
    useStore.getState().updateRoom({
      drawEvents: [...(useStore.getState().room?.drawEvents || []), event]
    });

    // Send to server
    socket.emit('draw:event', { event });
  };

  const commitText = () => {
    if (!textInput || !textInput.value.trim() || !player) {
      setTextInput(null);
      return;
    }
    const event = {
      type: 'text',
      userId: player.id,
      x: textInput.x,
      y: textInput.y,
      text: textInput.value,
      color,
      brushSize,
      timestamp: Date.now(),
      strokeId: Math.random().toString(36).substr(2, 9),
    };

    applyDrawEvent(event);
    useStore.getState().updateRoom({
      drawEvents: [...(useStore.getState().room?.drawEvents || []), event]
    });
    socket.emit('draw:event', { event });
    setTextInput(null);
  };

  const shapeStartRef = useRef(null);

  const startDrawing = (e) => {
    if (room?.status !== 'drawing') return;
    const { x, y } = getNormCoords(e);
    
    if (tool === 'text') {
      if (textInput) commitText();
      setTextInput({ x, y, value: '' });
      return;
    }

    if (tool === 'rect' || tool === 'circle' || tool === 'line') {
      shapeStartRef.current = { x, y };
      setIsDrawing(true);
      redoStackRef.current = [];
      return;
    }

    const strokeId = Math.random().toString(36).substr(2, 9);
    setCurrentStrokeId(strokeId);
    setIsDrawing(true);
    redoStackRef.current = []; // Clear redo stack on new stroke
    emitDrawEvent('stroke_start', x, y);
  };

  const draw = (e) => {
    if (!isDrawing || room?.status !== 'drawing') return;
    const { x, y } = getNormCoords(e);
    
    if (tool === 'rect' || tool === 'circle' || tool === 'line') {
      updateOverlayCursor(e.clientX, e.clientY, x, y);
      return;
    }

    emitDrawEvent('stroke_move', x, y);
    
    // Update local cursor on overlay
    updateOverlayCursor(e.clientX, e.clientY);
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    const { x, y } = getNormCoords(e);
    
    if (tool === 'rect' || tool === 'circle' || tool === 'line') {
      if (shapeStartRef.current) {
        emitShapeEvent(tool, shapeStartRef.current.x, shapeStartRef.current.y, x, y);
        shapeStartRef.current = null;
      }
    } else {
      emitDrawEvent('stroke_end', x, y);
    }
    
    setIsDrawing(false);
  };

  const updateOverlayCursor = (clientX, clientY, normX, normY) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    const rect = overlay.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    if (tool === 'text') {
      ctx.font = `bold ${brushSize * 2}px Inter`;
      ctx.fillStyle = color;
      ctx.fillText('A', px, py);
      return;
    }

    if (isDrawing && shapeStartRef.current && (tool === 'rect' || tool === 'circle' || tool === 'line')) {
      const startX = shapeStartRef.current.x * overlay.width;
      const startY = shapeStartRef.current.y * overlay.height;
      const endX = (normX !== undefined ? normX : shapeStartRef.current.x) * overlay.width;
      const endY = (normY !== undefined ? normY : shapeStartRef.current.y) * overlay.height;

      ctx.beginPath();
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = color;
      
      if (tool === 'rect') {
        ctx.strokeRect(startX, startY, endX - startX, endY - startY);
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (tool === 'line') {
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
      return;
    }

    // Draw cursor indicator
    ctx.beginPath();
    ctx.arc(px, py, tool === 'eraser' ? brushSize * 1.5 : brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === 'eraser' ? 'rgba(255,255,255,0.5)' : color;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const handleMouseMove = (e) => {
    const { x, y } = getNormCoords(e);
    updateOverlayCursor(e.clientX, e.clientY);
    draw(e);
    socket.emit('cursor:move', { x, y, isDrawing });
  };

  const handleMouseLeave = (e) => {
    stopDrawing(e);
    socket.emit('cursor:leave');
    const overlay = overlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
  };

  return (
    <div className="relative w-full shadow-2xl rounded-lg overflow-hidden border border-gray-800">
      <canvas
        id="drawing-board"
        ref={canvasRef}
        className="block bg-[#1a1a1a]"
      />
      <canvas
        ref={overlayRef}
        className={`absolute top-0 left-0 w-full h-full ${room?.status === 'drawing' && !player?.isSpectator ? 'cursor-none pointer-events-auto' : 'cursor-default pointer-events-none'}`}
        onMouseDown={startDrawing}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDrawing}
        onMouseLeave={handleMouseLeave}
      />

      {textInput && (
        <input
          autoFocus
          className="absolute bg-transparent outline-none z-[60] whitespace-pre"
          style={{
            left: `${textInput.x * 100}%`,
            top: `${textInput.y * 100}%`,
            color: color,
            fontSize: `${brushSize * 2}px`,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 'bold',
            transform: 'translateY(-100%)' // Align bottom of text with cursor
          }}
          value={textInput.value}
          onChange={(e) => setTextInput(prev => ({ ...prev, value: e.target.value }))}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText();
            e.stopPropagation(); // prevent global shortcuts like undo
          }}
        />
      )}

      {/* Remote Cursors */}
      {Object.entries(remoteCursors).map(([userId, cursor]) => {
        const player = room?.players.find(p => p.id === userId);
        if (!player || player.isSpectator) return null;
        return (
          <div
            key={userId}
            className="absolute pointer-events-none z-50 flex items-center gap-1 transition-all duration-75 ease-linear"
            style={{ left: cursor.x * 100 + '%', top: cursor.y * 100 + '%' }}
          >
            <div 
              className={`w-4 h-4 rounded-full border-2 border-white shadow-lg ${cursor.isDrawing ? 'animate-pulse scale-125' : ''}`}
              style={{ backgroundColor: player.color }}
            />
            <div 
              className="px-2 py-0.5 rounded text-xs font-bold text-black whitespace-nowrap shadow-md opacity-70"
              style={{ backgroundColor: player.color }}
            >
              {player.name}
              {cursor.isDrawing && ' ✏️'}
            </div>
          </div>
        );
      })}

      {/* Floating Reactions */}
      {reactions.map(r => (
        <div
          key={r.id}
          className="absolute text-5xl pointer-events-none z-[70] drop-shadow-2xl"
          style={{
            left: `${r.startX}%`,
            bottom: '-50px',
            animation: 'floatUp 3s ease-out forwards'
          }}
        >
          {r.emoji}
        </div>
      ))}
      
      {room?.status !== 'drawing' && room?.status !== 'ended' && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-2">Waiting to start...</h2>
            {room?.hostId === player?.id ? (
              <p className="text-gray-400">Click Start Game when everyone is ready</p>
            ) : (
              <p className="text-gray-400">Waiting for host to start the game</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
