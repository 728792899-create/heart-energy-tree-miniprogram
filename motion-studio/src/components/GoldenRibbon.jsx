import React from 'react';

export const GoldenRibbon = ({ label = 'TOGETHER', progress = 1, style = {} }) => (
  <div style={{ position: 'relative', minWidth: 210, padding: '18px 42px', color: '#6F512A', background: 'linear-gradient(90deg, #E5C885, #F7E5B8 50%, #D4AE6A)', borderRadius: 999, fontFamily: 'Arial, sans-serif', fontWeight: 900, fontSize: 23, letterSpacing: 3, textAlign: 'center', boxShadow: '0 13px 26px rgba(111,81,42,.2)', opacity: progress, transform: `scaleX(${0.3 + progress * 0.7})`, ...style }}>
    <div style={{ position: 'absolute', left: -34, top: 13, width: 52, height: 42, clipPath: 'polygon(0 0, 100% 18%, 100% 82%, 0 100%, 22% 50%)', background: '#C89D4F' }} />
    <div style={{ position: 'absolute', right: -34, top: 13, width: 52, height: 42, clipPath: 'polygon(0 18%, 100% 0, 78% 50%, 100% 100%, 0 82%)', background: '#C89D4F' }} />
    <span style={{ position: 'relative' }}>{label}</span>
  </div>
);
