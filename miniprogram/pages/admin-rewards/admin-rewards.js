const api = require('../../services/api');
const privacy = require('../../services/privacy');

Page({
  data: {
    loading: true,
    errorMessage: '',
    dashboard: {
      relationship: {}
    },
    items: [],
    activeRewardCount: 0,
    inactiveRewardCount: 0,
    formVisible: false,
    editingId: '',
    name: '',
    description: '',
    priceYuan: '',
    category: 'emotion',
    categoryIndex: 3,
    imageTone: '#ffe0ea',
    imagePreview: '',
    imageFileId: '',
    imageChanged: false,
    editingIsActive: true,
    stock: '-1',
    saving: false,
    processingRewardId: '',
    categories: [
      { key: 'food', label: '美食' },
      { key: 'date', label: '约会' },
      { key: 'gift', label: '礼物' },
      { key: 'emotion', label: '情感' }
    ]
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const dashboard = await api.queryDashboard();
      if (dashboard && dashboard.needsBinding) {
        this.setData({ loading: false });
        return;
      }
      const categoryLabels = Object.fromEntries(this.data.categories.map((category) => [category.key, category.label]));
      const fallbackImages = {
        food: '/assets/stitch-original/reward-dinner.jpg',
        date: '/assets/stitch-original/reward-massage.jpg',
        gift: '/assets/stitch-original/redemption-gift.jpg',
        emotion: '/assets/stitch-original/reward-dishes.jpg'
      };
      const items = (await api.queryRewardItems({ category: 'all', includeInactive: true })).map((item) => ({
        ...item,
        categoryLabel: categoryLabels[item.category] || item.category,
        displayImageSrc: item.imageSrc || item.imageUrl || fallbackImages[item.category] || fallbackImages.gift,
        statusText: item.isActive === false ? '已下架' : '上架中',
        statusTone: item.isActive === false ? 'muted' : 'active'
      }));
      this.setData({
        dashboard,
        items,
        activeRewardCount: items.filter((item) => item.isActive !== false).length,
        inactiveRewardCount: items.filter((item) => item.isActive === false).length,
        loading: false
      });
      if (!this.data.editingId && !this.data.formVisible) this.resetForm();
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '奖品管理页暂时没有加载出来'
      });
    }
  },

  retryLoad() {
    if (!this.data.loading) this.load();
  },

  resetForm() {
    this.setData({
      formVisible: false,
      editingId: '',
      name: '',
      description: '',
      priceYuan: '',
      category: 'emotion',
      categoryIndex: 3,
      imageTone: '#ffe0ea',
      imagePreview: '',
      imageFileId: '',
      imageChanged: false,
      editingIsActive: true,
      stock: '-1',
      saving: false
    });
  },

  openCreate() {
    if (this.data.saving || this.data.processingRewardId) return;
    this.resetForm();
    this.setData({ formVisible: true });
    wx.pageScrollTo({ selector: '#reward-editor', duration: 240 });
  },

  closeEditor() {
    if (this.data.saving || this.data.processingRewardId) return;
    this.resetForm();
  },

  goRules() {
    wx.navigateTo({ url: '/pages/sponsor-rules/sponsor-rules' });
  },

  onInput(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value });
  },

  onCategoryChange(event) {
    const index = Number(event.detail.value || 0);
    const category = this.data.categories[index] || this.data.categories[0];
    this.setData({
      categoryIndex: index,
      category: category.key
    });
  },

  edit(event) {
    const id = event.currentTarget.dataset.id;
    const item = this.data.items.find((reward) => reward.id === id);
    if (!item) return;
    const categoryIndex = Math.max(0, this.data.categories.findIndex((category) => category.key === item.category));
    this.setData({
      formVisible: true,
      editingId: item.id,
      name: item.name,
      description: item.description,
      priceYuan: String(Number(item.priceCents || 0) / 100),
      category: item.category,
      categoryIndex,
      imageTone: item.imageTone || '#ffe0ea',
      imagePreview: item.imageSrc || item.imageUrl || '',
      imageFileId: item.imageFileId || '',
      imageChanged: false,
      editingIsActive: item.isActive !== false,
      stock: String(item.stock === undefined ? -1 : item.stock)
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },

  async chooseImage() {
    if (this.data.saving || this.data.processingRewardId) return;
    const authorized = await privacy.ensurePhotoPrivacy();
    if (!authorized) return;
    const setPickedImage = (filePath) => {
      if (!filePath) {
        wx.showToast({ title: '没有读取到图片路径', icon: 'none' });
        return;
      }
      this.setData({
        imagePreview: filePath,
        imageChanged: true
      });
    };
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const file = res.tempFiles && res.tempFiles[0];
          setPickedImage(file && (file.tempFilePath || file.path));
        }
      });
      return;
    }
    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: (res) => setPickedImage(res.tempFilePaths && res.tempFilePaths[0])
    });
  },

  async save() {
    if (this.data.saving || this.data.processingRewardId) return;
    this.setData({ saving: true });
    let uploadedImageFileId = '';
    try {
      const relationshipId = this.data.dashboard.relationship.id;
      let imageFileId = this.data.imageFileId;
      if (this.data.imageChanged && this.data.imagePreview) {
        uploadedImageFileId = await api.uploadRewardImage({
          relationshipId,
          rewardId: this.data.editingId || 'new',
          filePath: this.data.imagePreview
        });
        imageFileId = uploadedImageFileId;
      }
      await api.saveRewardItem({
        id: this.data.editingId,
        relationshipId,
        name: this.data.name,
        description: this.data.description,
        priceCents: api.centsFromYuan(this.data.priceYuan),
        category: this.data.category,
        imageTone: this.data.imageTone,
        imageFileId,
        stock: this.data.stock,
        isActive: this.data.editingId ? this.data.editingIsActive : true
      });
      uploadedImageFileId = '';
      wx.showToast({ title: this.data.editingId ? '已保存修改' : '已新增奖励', icon: 'success' });
      this.resetForm();
      this.load();
    } catch (error) {
      if (uploadedImageFileId) await api.cleanupUploadedFile(uploadedImageFileId);
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  async toggle(event) {
    if (this.data.saving || this.data.processingRewardId) return;
    const rewardId = event.currentTarget.dataset.id;
    this.setData({ processingRewardId: rewardId });
    try {
      await api.toggleRewardItem({ rewardId });
      await this.load();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ processingRewardId: '' });
    }
  },

  delete(event) {
    if (this.data.saving || this.data.processingRewardId) return;
    const id = event.currentTarget.dataset.id;
    this.setData({ processingRewardId: id });
    wx.showModal({
      title: '确认删除奖品',
      content: '没有兑换历史的奖品会删除；已有兑换历史的奖品会自动下架，保留历史记录。',
      success: async (res) => {
        if (!res.confirm) {
          this.setData({ processingRewardId: '' });
          return;
        }
        try {
          await api.deleteRewardItem({
            rewardId: id,
            confirmed: true,
            note: '男友端删除奖品'
          });
          wx.showToast({ title: '已处理', icon: 'success' });
          if (this.data.editingId === id) this.resetForm();
          await this.load();
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' });
        } finally {
          this.setData({ processingRewardId: '' });
        }
      },
      fail: () => {
        this.setData({ processingRewardId: '' });
      }
    });
  }
});
