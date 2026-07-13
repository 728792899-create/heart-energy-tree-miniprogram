import React from 'react';

export const GiftBox = ({ progress = 1, style = {} }) => (
  <div style={{ position: 'relative', width: 160, height: 155, opacity: progress, transform: `translateY(${(1 - progress) * 70}px) scale(${0.65 + progress * 0.35}) rotate(${(1 - progress) * -8}deg)`, ...style }}>
    <div style={{ position: 'absolute', left: '10%', bottom: 0, width: '80%', height: '68%', borderRadius: 18, background: 'linear-gradient(145deg, #E77C99, #B74465)', boxShadow: '0 18px 30px rgba(125,47,73,.22)' }} />
    <div style={{ position: 'absolute', left: 0, top: '25%', width: '100%', height: '25%', borderRadius: 14, background: '#F8E6EC', border: '4px solid #D4AE6A' }} />
    <div style={{ position: 'absolute', left: '44%', top: '26%', width: '12%', height: '74%', background: '#D4AE6A' }} />
    <div style={{ position: 'absolute', left: '21%', top: 0, width: '31%', height: '34%', borderRadius: '70% 15% 70% 15%', border: '10px solid #D4AE6A', transform: 'rotate(11deg)' }} />
    <div style={{ position: 'absolute', right: '21%', top: 0, width: '31%', height: '34%', borderRadius: '15% 70% 15% 70%', border: '10px solid #D4AE6A', transform: 'rotate(-11deg)' }} />
  </div>
);
