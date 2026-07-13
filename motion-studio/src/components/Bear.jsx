import React from 'react';

export const Bear = ({ size = 176, style = {} }) => {
  const berry = '#B74465';
  const fur = '#9A6B4B';
  const dark = '#543B31';

  return (
    <div style={{ position: 'relative', width: size, height: size * 1.08, ...style }}>
      <div style={{ position: 'absolute', left: size * 0.06, top: size * 0.02, width: size * 0.32, height: size * 0.32, borderRadius: '50%', background: dark }} />
      <div style={{ position: 'absolute', right: size * 0.06, top: size * 0.02, width: size * 0.32, height: size * 0.32, borderRadius: '50%', background: dark }} />
      <div style={{ position: 'absolute', left: size * 0.08, top: size * 0.1, width: size * 0.84, height: size * 0.75, borderRadius: '46% 46% 42% 42%', background: fur, boxShadow: '0 16px 30px rgba(69,52,58,.16)' }}>
        <div style={{ position: 'absolute', left: '25%', top: '35%', width: '8%', height: '10%', borderRadius: '50%', background: dark }} />
        <div style={{ position: 'absolute', right: '25%', top: '35%', width: '8%', height: '10%', borderRadius: '50%', background: dark }} />
        <div style={{ position: 'absolute', left: '34%', top: '48%', width: '32%', height: '25%', borderRadius: '50%', background: '#E8C9AB' }}>
          <div style={{ position: 'absolute', left: '39%', top: '14%', width: '22%', height: '25%', borderRadius: '50%', background: dark }} />
          <div style={{ position: 'absolute', left: '34%', top: '48%', width: '32%', height: '14%', borderBottom: `3px solid ${dark}`, borderRadius: '50%' }} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: size * 0.17, bottom: 0, width: size * 0.66, height: size * 0.34, borderRadius: '45% 45% 24% 24%', background: '#865B42' }} />
      <div style={{ position: 'absolute', left: size * 0.09, top: size * 0.72, width: size * 0.82, height: size * 0.14, borderRadius: 999, background: berry, transform: 'rotate(-4deg)', boxShadow: '0 8px 18px rgba(183,68,101,.24)' }} />
    </div>
  );
};
