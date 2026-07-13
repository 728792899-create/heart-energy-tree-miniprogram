Component({
  properties: {
    recap: { type: Object, value: null },
    role: { type: String, value: 'participant' },
    compact: { type: Boolean, value: true }
  },
  methods: {
    open() {
      this.triggerEvent('open');
    }
  }
});
