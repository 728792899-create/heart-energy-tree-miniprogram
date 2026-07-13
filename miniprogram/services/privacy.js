function ensurePhotoPrivacy(usageLabel = '上传打卡照片') {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.requirePrivacyAuthorize !== 'function') {
      resolve(true);
      return;
    }

    wx.requirePrivacyAuthorize({
      success: () => resolve(true),
      fail: () => {
        wx.showToast({
          title: `需要同意隐私授权后才能${usageLabel}`,
          icon: 'none'
        });
        resolve(false);
      }
    });
  });
}

module.exports = {
  ensurePhotoPrivacy
};
