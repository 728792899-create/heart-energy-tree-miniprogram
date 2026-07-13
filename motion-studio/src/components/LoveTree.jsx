import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

const leaves = [
  [50, 2, 54], [28, 16, 44], [68, 18, 46], [15, 36, 38], [45, 34, 58],
  [76, 39, 40], [25, 57, 42], [61, 59, 48], [44, 72, 36]
];

export const LoveTree = ({ progress = 1, posterMode = false, style = {} }) => {
  const frame = useCurrentFrame();
  const sway = posterMode ? 0 : Math.sin(frame / 18) * 1.5;

  return (
    <div style={{ position: 'relative', width: 250, height: 280, transform: `rotate(${sway}deg) scale(${0.72 + progress * 0.28})`, transformOrigin: '50% 100%', ...style }}>
      <div style={{ position: 'absolute', left: '45%', bottom: 0, width: '12%', height: '55%', borderRadius: 999, background: 'linear-gradient(90deg, #714B37, #A87855, #714B37)', transform: 'rotate(2deg)' }} />
      <div style={{ position: 'absolute', left: '22%', bottom: '36%', width: '32%', height: '8%', borderRadius: 999, background: '#85583E', transform: 'rotate(-31deg)' }} />
      <div style={{ position: 'absolute', right: '20%', bottom: '43%', width: '34%', height: '8%', borderRadius: 999, background: '#85583E', transform: 'rotate(28deg)' }} />
      {leaves.map(([left, top, size], index) => {
        const leafProgress = posterMode ? 1 : interpolate(progress, [index / 16, 0.55 + index / 20], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp'
        });

        return (
          <div key={`${left}-${top}`} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, color: index % 3 === 0 ? '#D4AE6A' : index % 2 ? '#E77C99' : '#B74465', fontSize: size, opacity: leafProgress, transform: `translate(-50%, -50%) scale(${leafProgress})`, filter: 'drop-shadow(0 7px 8px rgba(125,47,73,.15))' }}>♥</div>
        );
      })}
    </div>
  );
};
