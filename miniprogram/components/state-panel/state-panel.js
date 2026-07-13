Component({
  properties: {
    state: { type: String, value: 'loading' },
    title: { type: String, value: '' },
    description: { type: String, value: '' },
    actionText: { type: String, value: '重新加载' },
    showAction: { type: Boolean, value: true }
  },
  methods: {
    retry() {
      this.triggerEvent('retry');
    }
  }
});
