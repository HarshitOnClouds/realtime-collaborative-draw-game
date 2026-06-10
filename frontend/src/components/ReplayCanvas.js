'use client';

import { useEffect, useRef, useState } from 'react';

export default function ReplayCanvas({ room, isPlaying, speed }) {
  const canvasRef = useRef(null);
  const lastCoordsRef = useRef({});
  const animationRef = useRef(null);
  const progressRef = useRef(0); // Tracks current "time" in replay
  const timeDisplayRef = useRef(null); // Direct DOM ref for performance

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    
    // Set explicit size
    const width = container.clientWidth;
    const height = width * (9 / 16);
    canvas.width = width;
    canvas.height = height;

    const events = [...(room?.drawEvents || [])].sort((a, b) => a.timestamp - b.timestamp);
    if (events.length === 0) return;

    const startTime = events[0].timestamp;
    const endTime = events[events.length - 1].timestamp;
    const totalDuration = endTime - startTime;

    const applyDrawEvent = (event) => {
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
      } else if (event.type === 'stroke_end' || event.type === 'undo') {
        delete lastCoordsRef.current[event.strokeId];
        if (event.type === 'undo') {
           // We don't implement full visual undo within the playback tick easily 
           // since we draw directly to canvas. 
           // In a real robust system, we would clear and redraw all events up to the current progress time.
           // For v1, we will just clear and redraw all events up to `progressRef.current`
           redrawUpTo(progressRef.current);
        }
      }
    };

    const redrawUpTo = (currentTime) => {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      lastCoordsRef.current = {};
      
      for (const ev of events) {
        if (ev.timestamp - startTime <= currentTime) {
          applyDrawEvent(ev);
        } else {
          break; // Since events are sorted
        }
      }
    };

    let lastFrameTime = performance.now();

    const animate = (time) => {
      if (!isPlaying) {
        lastFrameTime = time;
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const deltaTime = time - lastFrameTime;
      lastFrameTime = time;

      progressRef.current += deltaTime * speed;

      if (timeDisplayRef.current) {
        const secs = Math.floor(Math.min(progressRef.current, totalDuration) / 1000);
        timeDisplayRef.current.innerText = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;
      }

      if (progressRef.current > totalDuration) {
        progressRef.current = totalDuration;
        redrawUpTo(progressRef.current);
        // We could emit a callback here that playback finished
        return;
      }

      // Redraw everything up to the current progress time
      // This is less efficient than just drawing new strokes, but it handles undo correctly
      redrawUpTo(progressRef.current);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [room, isPlaying, speed]);

  return (
    <div className="relative w-full shadow-2xl rounded-lg overflow-hidden border border-gray-800">
      <canvas ref={canvasRef} className="block bg-[#1a1a1a]" />
      
      <div className="absolute top-4 right-4 bg-black/70 text-[#6ee7b7] px-3 py-1 rounded font-mono text-sm font-bold border border-gray-700 pointer-events-none">
        <span ref={timeDisplayRef}>0:00</span>
      </div>

      {!isPlaying && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
           <span className="text-white text-2xl font-bold uppercase tracking-widest">Paused</span>
        </div>
      )}
    </div>
  );
}
