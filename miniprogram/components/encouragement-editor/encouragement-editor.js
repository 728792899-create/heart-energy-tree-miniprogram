Component({
  properties: {
    templates: { type: Array, value: [] },
    selectedKey: { type: String, value: 'hug' },
    message: { type: String, value: '' },
    sending: { type: Boolean, value: false }
  },
  methods: {
    select(event) {
      if (this.data.sending) return;
      this.triggerEvent('select', { key: event.currentTarget.dataset.key });
    },
    input(event) {
      this.triggerEvent('input', { value: event.detail.value });
    },
    send() {
      if (this.data.sending) return;
      this.triggerEvent('send');
    }
  }
});
