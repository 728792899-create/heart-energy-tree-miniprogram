import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';

const particles = [
  [12, 72, 0, 24], [24, 23, 7, 18], [38, 82, 14, 20], [54, 17, 4, 26],
  [67, 75, 10, 18], [79, 27, 16, 23], [88, 62, 3, 17], [48, 89, 20, 16],
  [18, 47, 12, 15], [72, 47, 22, 14], [42, 11, 18, 13], [91, 38, 8, 13]
];

export const HeartParticles = ({ posterMode = false, color = '#B74465' }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map(([x, y, delay, size], index) => {
        const progress = posterMode ? 1 : interpolate(frame, [delay, delay + 34], [0, 1], {
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp'
        });
        const drift = posterMode ? 0 : Math.sin((frame + index * 7) / 12) * 10;

        return (
          <div
            key={`${x}-${y}`}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              color: index % 3 === 0 ? '#D4AE6A' : color,
              fontSize: size,
              opacity: 0.16 + progress * 0.66,
              transform: `translate(${drift}px, ${18 - progress * 34}px) scale(${0.5 + progress * 0.5}) rotate(${index % 2 ? 9 : -9}deg)`,
              textShadow: '0 6px 14px rgba(183,68,101,.18)'
            }}
          >
            ♥
          </div>
        );
      })}
    </div>
  );
};
