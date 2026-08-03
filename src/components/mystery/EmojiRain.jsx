import React, { useEffect, useState } from 'react';

export default function EmojiRain({ emote, trigger }) {
  const [drops, setDrops] = useState([]);

  useEffect(() => {
    if (!trigger || !emote) return;
    const newDrops = Array.from({ length: 18 }, (_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      size: 1.4 + Math.random() * 1.4,
      duration: 2.2 + Math.random() * 1.5
    }));
    setDrops(newDrops);
    const timer = setTimeout(() => setDrops([]), 4500);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (!drops.length) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {drops.map(drop => (
        <div
          key={drop.id}
          style={{
            position: 'absolute',
            left: `${drop.left}%`,
            top: '-60px',
            fontSize: `${drop.size}rem`,
            animation: `emojifall ${drop.duration}s ${drop.delay}s linear forwards`,
            opacity: 0
          }}
        >
          {emote}
        </div>
      ))}
      <style>{`
        @keyframes emojifall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}