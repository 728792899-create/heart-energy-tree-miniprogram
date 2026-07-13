const { resolveMotionAsset } = require('../../config/motion-assets');

Component({
  properties: {
    sceneKey: { type: String, value: 'companion-empty' },
    visible: { type: Boolean, value: true },
    autoplay: { type: Boolean, value: true },
    loop: { type: Boolean, value: false },
    soundMode: { type: String, value: 'on' },
    src: { type: String, value: '' },
    poster: { type: String, value: '' },
    compact: { type: Boolean, value: false }
  },
  data: {
    resolvedSrc: '',
    resolvedPoster: '',
    nativeVariant: 'hearts',
    videoFailed: false,
    posterFailed: false,
    sourceRequestId: 0
  },
  lifetimes: {
    attached() {
      this.syncAssets();
    },
    detached() {
      this.sourceRequestId = (this.sourceRequestId || 0) + 1;
    }
  },
  observers: {
    'sceneKey,src,poster': function refreshAssets() {
      this.syncAssets();
    }
  },
  methods: {
    syncAssets() {
      const resolved = resolveMotionAsset(this.data.sceneKey, {
        src: this.data.src,
        poster: this.data.poster
      });
      const requestId = (this.sourceRequestId || 0) + 1;
      this.sourceRequestId = requestId;
      this.setData({
        resolvedSrc: '',
        resolvedPoster: resolved.poster,
        nativeVariant: resolved.nativeVariant,
        videoFailed: false,
        posterFailed: false
      });
      this.resolveVideoSource(resolved.videoSrc, requestId);
    },
    resolveVideoSource(source, requestId) {
      if (!source) return;
      if (!source.startsWith('cloud://')) {
        this.setData({ resolvedSrc: source });
        return;
      }
      if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') {
        this.usePosterFallback();
        return;
      }
      wx.cloud.getTempFileURL({ fileList: [source] })
        .then((result) => {
          if (requestId !== this.sourceRequestId) return;
          const item = result && result.fileList && result.fileList[0];
          if (!item || item.status !== 0 || !item.tempFileURL) {
            this.usePosterFallback();
            return;
          }
          this.setData({ resolvedSrc: item.tempFileURL });
        })
        .catch(() => {
          if (requestId === this.sourceRequestId) this.usePosterFallback();
        });
    },
    usePosterFallback() {
      this.setData({ videoFailed: true, resolvedSrc: '' });
      this.triggerEvent('fallback', { level: 'poster', sceneKey: this.data.sceneKey });
    },
    onVideoError() {
      this.usePosterFallback();
    },
    onPosterError() {
      this.setData({ posterFailed: true });
      this.triggerEvent('fallback', { level: 'native', sceneKey: this.data.sceneKey });
    },
    onEnded() {
      this.triggerEvent('ended', { sceneKey: this.data.sceneKey });
    },
    onNativeEnded() {
      this.triggerEvent('ended', { sceneKey: this.data.sceneKey, fallback: 'native' });
    }
  }
});
