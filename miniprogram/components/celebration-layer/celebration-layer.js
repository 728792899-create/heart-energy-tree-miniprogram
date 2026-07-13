Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '这一刻值得一起庆祝' },
    message: { type: String, value: '你们又一起向前走了一步。' },
    sceneKey: { type: String, value: 'first-checkin' },
    motionSrc: { type: String, value: '' },
    poster: { type: String, value: '' },
    soundMode: { type: String, value: 'on' }
  },
  methods: {
    close() {
      this.triggerEvent('close');
    },
    stopTouch() {}
  }
});
