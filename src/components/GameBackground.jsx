import React from 'react';

const STARS = 'radial-gradient(1.5px 1.5px at 12% 12%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 28% 6%, rgba(255,255,255,0.5), transparent), radial-gradient(1.5px 1.5px at 65% 5%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 80% 14%, rgba(255,255,255,0.5), transparent), radial-gradient(1.5px 1.5px at 92% 8%, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 6% 30%, rgba(255,255,255,0.4), transparent), radial-gradient(1.5px 1.5px at 95% 28%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 4% 55%, rgba(255,255,255,0.4), transparent), radial-gradient(1.5px 1.5px at 93% 50%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 15% 68%, rgba(255,255,255,0.35), transparent), radial-gradient(1.5px 1.5px at 88% 70%, rgba(255,255,255,0.45), transparent), radial-gradient(1px 1px at 40% 78%, rgba(255,255,255,0.3), transparent), radial-gradient(1.5px 1.5px at 70% 88%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 25% 92%, rgba(255,255,255,0.3), transparent), radial-gradient(1.5px 1.5px at 55% 95%, rgba(255,255,255,0.35), transparent)';

/**
 * The one shared backdrop for every screen: deep-space base, overhead light,
 * ambient purple wash, warm undertone, drifting star field, and vignette.
 * `spotlight` adds the focused glow used behind the Home logo — leave it off
 * everywhere else.
 */
export default function GameBackground({ spotlight = false }) {
  return (
    <>
      <div className="fixed inset-0 -z-10 bg-[#07040f]" />
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 120% 38% at 50% -8%, rgba(255,255,255,0.05), transparent 60%)' }} />
      {spotlight && (
        <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 46% 26% at 50% 21%, rgba(160,100,255,0.42), transparent 68%)' }} />
      )}
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 90% 55% at 50% 15%, rgba(140,90,220,0.22), transparent 70%)' }} />
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 100% 60% at 50% 100%, rgba(70,32,140,0.18), transparent 62%)' }} />
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 55% 26% at 50% 96%, rgba(140,70,20,0.07), transparent 65%)' }} />
      <div className="fixed inset-0 -z-10 opacity-70" style={{
        backgroundImage: STARS,
        backgroundSize: '100% 100%',
        animation: 'twinkle 6s ease-in-out infinite alternate, driftSlow 50s ease-in-out infinite alternate',
        willChange: 'transform, opacity',
      }} />
      <div className="fixed inset-0 -z-10" style={{ boxShadow: 'inset 0 0 min(42vw,290px) rgba(0,0,0,0.92)' }} />
    </>
  );
}
