import React from 'react';

export const PaperPlane = ({ progress = 1, style = {} }) => (
  <div style={{ position: 'relative', width: 124, height: 90, opacity: progress, transform: `translate(${(1 - progress) * -120}px, ${(1 - progress) * 80}px) rotate(${-14 + progress * 18}deg)`, filter: 'drop-shadow(0 12px 12px rgba(69,52,58,.16))', ...style }}>
    <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(0 42%, 100% 0, 67% 100%, 48% 61%)', background: 'linear-gradient(145deg, #FFFDF9, #F2DDE3)', border: '3px solid rgba(183,68,101,.22)' }} />
    <div style={{ position: 'absolute', left: '47%', top: '17%', width: 3, height: '52%', background: '#D4AE6A', transform: 'rotate(54deg)', transformOrigin: 'top' }} />
    <div style={{ position: 'absolute', left: '51%', top: '46%', color: '#B74465', fontSize: 24 }}>♥</div>
  </div>
);
