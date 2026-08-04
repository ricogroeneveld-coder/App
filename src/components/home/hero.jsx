import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import HeroLogo from './HeroLogo';

function QuestionBubble({ className = '' }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Question mark">
      <defs>
        <linearGradient id="heroBubbleFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e4defe" />
        </linearGradient>
        <linearGradient id="heroMarkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="100%" stopColor="#f5a524" />
        </linearGradient>
      </defs>
      <path
        d="M60 8c28.7 0 52 20.5 52 45.8 0 22.3-18.3 41-42.7 45l-2 12.6c-.5 3-3.1 5.2-6.1 5.2h-2.4c-3 0-5.6-2.2-6.1-5.2l-2-12.7C26.9 94.6 8 75.9 8 53.8 8 28.5 31.3 8 60 8z"
        fill="url(#heroBubbleFill)"
        stroke="#241454"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <text
        x="60"
        y="72"
        textAnchor="middle"
        fontFamily="'Baloo 2', 'Nunito', sans-serif"
        fontWeight="800"
        fontSize="58"
        fill="url(#heroMarkFill)"
        stroke="#241454"
        strokeWidth="3"
        paintOrder="stroke"
      >
        ?
      </text>
    </svg>
  );
}

export default function Hero({ className = '' }) {
  const prefersReducedMotion = useReducedMotion();

  const floatAnimation = prefersReducedMotion
    ? {}
    : { y: [0, -8, 0] };
  const floatTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={`relative flex flex-col items-center text-center px-4 pt-2 pb-4 ${className}`}
    >
      <motion.div
        initial={{ scale: 0, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
        className="relative mb-2"
      >
        <motion.div animate={floatAnimation} transition={floatTransition} className="relative">
          <div
            className="pointer-events-none absolute inset-0 scale-[1.8] rounded-full bg-violet-500/40 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 scale-125 rounded-full bg-fuchsia-400/30 blur-xl"
            aria-hidden="true"
          />
          <QuestionBubble className="relative h-16 w-16 sm:h-20 sm:w-20 drop-shadow-[0_8px_24px_rgba(139,92,246,0.55)]" />
        </motion.div>
      </motion.div>

      <HeroLogo />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
        className="relative mt-5"
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-violet-600/40 via-fuchsia-500/40 to-violet-600/40 blur-md"
          aria-hidden="true"
        />
        <div className="relative rounded-full border border-white/15 bg-white/5 px-5 py-2 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
          <p className="font-['Nunito',_sans-serif] text-xs sm:text-sm font-bold uppercase tracking-[0.18em] text-violet-100/90">
            The interactive guessing game
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
