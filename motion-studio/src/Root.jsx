import React from 'react';
import { Composition, Folder, Still } from 'remotion';
import { HeartTreeScene } from './HeartTreeScene';

const { SCENES } = require('./scene-definitions');

export const RemotionRoot = () => (
  <>
    <Folder name="Heart-Tree-Videos">
      {SCENES.map((scene) => (
        <Composition
          key={scene.compositionId}
          id={scene.compositionId}
          component={HeartTreeScene}
          durationInFrames={scene.durationInFrames}
          fps={scene.fps}
          width={scene.width}
          height={scene.height}
          defaultProps={{ sceneKey: scene.sceneKey, posterMode: false }}
        />
      ))}
    </Folder>
    <Folder name="Heart-Tree-Posters">
      {SCENES.map((scene) => (
        <Still
          key={scene.posterId}
          id={scene.posterId}
          component={HeartTreeScene}
          width={scene.width}
          height={scene.height}
          defaultProps={{ sceneKey: scene.sceneKey, posterMode: true }}
        />
      ))}
    </Folder>
  </>
);
