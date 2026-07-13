Component({
  properties: {
    item: { type: Object, value: null },
    processing: { type: Boolean, value: false },
    actionText: { type: String, value: '收进我们的故事' }
  },
  methods: {
    accept() {
      if (this.data.processing || !this.data.item) return;
      this.triggerEvent('accept', { id: this.data.item.id });
    }
  }
});
