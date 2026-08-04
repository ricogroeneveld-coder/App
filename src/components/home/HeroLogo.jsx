import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const OUTLINE_COLOR = '#1e1147';
const FONT_STACK = "'Baloo 2', 'Nunito', sans-serif";

function extrudeShadow(steps = 5) {
  const layers = [];
  for (let i = 1; i <= steps; i++) {
    layers.push(`${i}px ${i}px 0 ${OUTLINE_COLOR}`);
  }
  layers.push(`${steps + 3}px ${steps + 5}px 12px rgba(0,0,0,0.45)`);
  return layers.join(', ');
}

function LogoWord({ text, gradientFrom, gradientTo, className = '' }) {
  const fillStyle = {
    fontFamily: FONT_STACK,
    WebkitTextStroke: `2.5px ${OUTLINE_COLOR}`,
    textShadow: extrudeShadow(5),
    backgroundImage: `linear-gradient(180deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: 'transparent',
  };
  const glossStyle = {
    fontFamily: FONT_STACK,
    backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 46%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: 'transparent',
  };
  const sizingStyle = { fontFamily: FONT_STACK };

  return (
    <span className={`relative inline-block font-extrabold leading-none ${className}`}>
      <span aria-hidden="true" className="absolute inset-0 select-none" style={fillStyle}>
        {text}
      </span>
      <span aria-hidden="true" className="absolute inset-0 select-none" style={glossStyle}>
        {text}
      </span>
      <span className="invisible" style={sizingStyle}>
        {text}
      </span>
    </span>
  );
}

export default function HeroLogo({ className = '' }) {
  const prefersReducedMotion = useReducedMotion();

  const glowAnimation = prefersReducedMotion
    ? { opacity: 0.55 }
    : { opacity: [0.4, 0.7, 0.4] };
  const glowTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' };

  const wordVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.85, rotate: -3 },
    visible: (delay) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      rotate: 0,
      transition: { type: 'spring', stiffness: 260, damping: 18, delay },
    }),
  };

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0.4 }}
        animate={glowAnimation}
        transition={glowTransition}
        className="pointer-events-none absolute inset-0 -z-10 scale-125 rounded-full bg-gradient-to-r from-violet-600/50 via-fuchsia-500/40 to-indigo-500/50 blur-3xl"
      />

      <motion.div
        custom={0.2}
        initial="hidden"
        animate="visible"
        variants={wordVariants}
      >
        <LogoWord
          text="What's"
          gradientFrom="#ffffff"
          gradientTo="#d8d2f7"
          className="text-6xl sm:text-7xl md:text-8xl"
        />
      </motion.div>

      <div className="flex items-baseline gap-3 sm:gap-4">
        <motion.div custom={0.32} initial="hidden" animate="visible" variants={wordVariants}>
          <LogoWord
            text="my"
            gradientFrom="#ffffff"
            gradientTo="#d8d2f7"
            className="text-5xl sm:text-6xl md:text-7xl"
          />
        </motion.div>
        <motion.div custom={0.44} initial="hidden" animate="visible" variants={wordVariants}>
          <LogoWord
            text="Pick!"
            gradientFrom="#ffe08a"
            gradientTo="#f5a524"
            className="text-6xl sm:text-7xl md:text-8xl"
          />
        </motion.div>
      </div>
    </div>
  );
}
