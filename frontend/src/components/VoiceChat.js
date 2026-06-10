'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { socket } from '../lib/socket';

export default function VoiceChat() {
  const [peer, setPeer] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [streams, setStreams] = useState({}); // peerId -> stream
  const { player, room } = useStore();
  const [isMuted, setIsMuted] = useState(true);
  
  const peerInstance = useRef(null);
  const callsRef = useRef({});

  useEffect(() => {
    if (typeof window === 'undefined' || !player || !room) return;

    // Dynamically import PeerJS so it only runs on the client
    import('peerjs').then(({ default: Peer }) => {
      const newPeer = new Peer(undefined, {
        host: window.location.hostname,
        port: 4000, // Hardcoded for local dev backend, ideally from env
        path: '/peerjs',
      });

      newPeer.on('open', (id) => {
        setPeer(newPeer);
        peerInstance.current = newPeer;
        // Tell the server our peerId
        socket.emit('voice:register', { peerId: id });
      });

      newPeer.on('call', (call) => {
        // Answer incoming call with our stream (if we have one)
        call.answer(myStream || undefined);
        
        call.on('stream', (userVideoStream) => {
          setStreams((prev) => ({ ...prev, [call.peer]: userVideoStream }));
        });

        call.on('close', () => {
          setStreams((prev) => {
            const newStreams = { ...prev };
            delete newStreams[call.peer];
            return newStreams;
          });
        });

        callsRef.current[call.peer] = call;
      });
    });

    return () => {
      if (peerInstance.current) {
        peerInstance.current.destroy();
      }
    };
  }, [player?.id, room?.id]);

  // When we join and get our mic stream, call everyone else in the room
  useEffect(() => {
    if (!myStream || !peerInstance.current || !room) return;

    room.players.forEach((p) => {
      // Don't call ourselves, and only call if they have a peerId registered
      if (p.id !== player.id && p.peerId) {
        const call = peerInstance.current.call(p.peerId, myStream);
        if (call) {
          call.on('stream', (userVideoStream) => {
            setStreams((prev) => ({ ...prev, [p.peerId]: userVideoStream }));
          });
          callsRef.current[p.peerId] = call;
        }
      }
    });
  }, [myStream, room?.players, player?.id]);

  const toggleMute = async () => {
    if (isMuted) {
      // Attempt to get user media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setMyStream(stream);
        setIsMuted(false);
      } catch (err) {
        console.error('Failed to get local stream', err);
        alert('Could not access microphone. Please check permissions.');
      }
    } else {
      // Mute
      if (myStream) {
        myStream.getTracks().forEach(track => track.stop());
        setMyStream(null);
      }
      setIsMuted(true);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleMute}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
          isMuted ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)] hover:bg-red-600'
        }`}
        title="Toggle Microphone"
      >
        {isMuted ? '🎤 Unmute' : '🎙️ Muted (Click to Stop)'}
      </button>

      {/* Hidden audio tags to play streams */}
      {Object.entries(streams).map(([peerId, stream]) => (
        <AudioPlayer key={peerId} stream={stream} />
      ))}
    </div>
  );
}

function AudioPlayer({ stream }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
}
