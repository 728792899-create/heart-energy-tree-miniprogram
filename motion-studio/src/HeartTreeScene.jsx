import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from 'remotion';
import { Bear } from './components/Bear';
import { Rabbit } from './components/Rabbit';
import { HeartParticles } from './components/HeartParticles';
import { LoveTree } from './components/LoveTree';
import { PaperPlane } from './components/PaperPlane';
import { GiftBox } from './components/GiftBox';
import { GoldenRibbon } from './components/GoldenRibbon';

const { getSceneDefinition } = require('./scene-definitions');

export const HeartTreeScene = ({ sceneKey = 'companion-empty', posterMode = false }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const scene = getSceneDefinition(sceneKey);
  const portrait = height > width;
  const entrance = posterMode ? 1 : spring({
    frame,
    fps: 24,
    config: { damping: 16, stiffness: 120, mass: 0.9 },
    durationInFrames: 38
  });
  const settle = posterMode ? 1 : interpolate(frame, [8, 44], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const gentleFloat = posterMode ? 0 : Math.sin(frame / 12) * 8;
  const motifProgress = posterMode ? 1 : interpolate(frame, [18, 54], [0, 1], {
    easing: Easing.bezier(0.34, 1.3, 0.64, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const photoSize = portrait ? 560 : 445;
  const characterSize = portrait ? 148 : 126;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: 'linear-gradient(150deg, #FFFDF9 0%, #FFF9F5 44%, #F8E6EC 100%)', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ position: 'absolute', inset: portrait ? 44 : 30, border: '3px solid rgba(212,174,106,.42)', borderRadius: portrait ? 54 : 46, boxShadow: 'inset 0 0 0 12px rgba(255,255,255,.48)' }} />
      <div style={{ position: 'absolute', width: width * 0.74, height: width * 0.74, left: -width * 0.24, top: -width * 0.3, borderRadius: '50%', background: 'radial-gradient(circle, rgba(231,124,153,.22), rgba(231,124,153,0) 68%)' }} />
      <div style={{ position: 'absolute', width: width * 0.66, height: width * 0.66, right: -width * 0.24, bottom: -width * 0.24, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,174,106,.2), rgba(212,174,106,0) 70%)' }} />

      <HeartParticles posterMode={posterMode} />
      <LoveTree
        progress={settle}
        posterMode={posterMode}
        style={{
          position: 'absolute',
          left: portrait ? 24 : 8,
          bottom: portrait ? 86 : 28,
          opacity: scene.motif === 'tree' ? 0.2 : 0.1,
          filter: 'blur(.2px)'
        }}
      />

      <div style={{ position: 'absolute', left: '50%', top: portrait ? '43%' : '46%', width: photoSize, height: photoSize, padding: portrait ? 20 : 16, borderRadius: portrait ? 76 : 62, background: 'rgba(255,253,249,.9)', border: '3px solid rgba(212,174,106,.52)', boxShadow: '0 28px 60px rgba(69,52,58,.18)', opacity: entrance, transform: `translate(-50%, -50%) translateY(${(1 - entrance) * 90 + gentleFloat}px) scale(${0.78 + entrance * 0.22}) rotate(${(1 - entrance) * -3}deg)` }}>
        <Img
          src={staticFile(`characters/${scene.masterArtwork}`)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: portrait ? 58 : 48 }}
        />
        <div style={{ position: 'absolute', inset: portrait ? 20 : 16, borderRadius: portrait ? 58 : 48, boxShadow: 'inset 0 -80px 100px rgba(125,47,73,.08)' }} />
      </div>

      <Bear size={characterSize} style={{ position: 'absolute', left: portrait ? 78 : 54, bottom: portrait ? 104 : 65, opacity: settle, transform: `translateY(${(1 - settle) * 55}px) rotate(-5deg)` }} />
      <Rabbit size={characterSize} style={{ position: 'absolute', right: portrait ? 76 : 52, bottom: portrait ? 104 : 64, opacity: settle, transform: `translateY(${(1 - settle) * 55}px) rotate(5deg)` }} />

      <PaperPlane progress={scene.motif === 'plane' ? motifProgress : 0} style={{ position: 'absolute', right: portrait ? 84 : 52, top: portrait ? 116 : 72 }} />
      <GiftBox progress={scene.motif === 'gift' ? motifProgress : 0} style={{ position: 'absolute', right: portrait ? 72 : 44, top: portrait ? 132 : 82 }} />
      <GoldenRibbon label={scene.ribbonLabel} progress={motifProgress} style={{ position: 'absolute', left: '50%', bottom: portrait ? 70 : 42, transform: `translateX(-50%) scaleX(${0.3 + motifProgress * 0.7})` }} />
    </AbsoluteFill>
  );
};
