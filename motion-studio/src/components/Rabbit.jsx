import React from 'react';

export const Rabbit = ({ size = 170, style = {} }) => {
  const berry = '#B74465';
  const cream = '#FFF8EC';
  const outline = '#79656A';

  return (
    <div style={{ position: 'relative', width: size, height: size * 1.12, ...style }}>
      <div style={{ position: 'absolute', left: size * 0.18, top: 0, width: size * 0.22, height: size * 0.58, borderRadius: '50% 50% 42% 42%', background: cream, border: `3px solid ${outline}`, transform: 'rotate(-7deg)' }} />
      <div style={{ position: 'absolute', right: size * 0.18, top: 0, width: size * 0.22, height: size * 0.58, borderRadius: '50% 50% 42% 42%', background: cream, border: `3px solid ${outline}`, transform: 'rotate(7deg)' }} />
      <div style={{ position: 'absolute', left: size * 0.1, top: size * 0.24, width: size * 0.8, height: size * 0.7, borderRadius: '48% 48% 43% 43%', background: cream, border: `3px solid ${outline}`, boxShadow: '0 16px 30px rgba(69,52,58,.13)' }}>
        <div style={{ position: 'absolute', left: '25%', top: '38%', width: '7%', height: '10%', borderRadius: '50%', background: outline }} />
        <div style={{ position: 'absolute', right: '25%', top: '38%', width: '7%', height: '10%', borderRadius: '50%', background: outline }} />
        <div style={{ position: 'absolute', left: '45%', top: '51%', width: '10%', height: '8%', borderRadius: '50%', background: '#D88498' }} />
        <div style={{ position: 'absolute', left: '40%', top: '58%', width: '20%', height: '10%', borderBottom: `3px solid ${outline}`, borderRadius: '50%' }} />
      </div>
      <div style={{ position: 'absolute', left: size * 0.12, top: size * 0.24, width: size * 0.76, height: size * 0.13, borderRadius: 999, background: berry, transform: 'rotate(-5deg)', boxShadow: '0 7px 16px rgba(183,68,101,.22)' }} />
      <div style={{ position: 'absolute', right: size * 0.1, top: size * 0.16, width: size * 0.22, height: size * 0.22, borderRadius: '60% 40% 60% 40%', background: '#D4AE6A', transform: 'rotate(22deg)' }} />
    </div>
  );
};
