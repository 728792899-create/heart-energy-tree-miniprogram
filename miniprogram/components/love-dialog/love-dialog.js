Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '请再确认一次' },
    message: { type: String, value: '' },
    confirmText: { type: String, value: '确认' },
    cancelText: { type: String, value: '再想想' },
    showCancel: { type: Boolean, value: true },
    dangerous: { type: Boolean, value: false },
    processing: { type: Boolean, value: false }
  },
  methods: {
    confirm() {
      if (this.data.processing) return;
      this.triggerEvent('confirm');
    },
    cancel() {
      if (this.data.processing) return;
      this.triggerEvent('cancel');
    },
    stopTouch() {}
  }
});
