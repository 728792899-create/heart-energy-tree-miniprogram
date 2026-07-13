const tempUrlCache = {};

function isCloudFileId(value) {
  return typeof value === 'string' && value.indexOf('cloud://') === 0;
}

function canUseCloudTempUrl() {
  return typeof wx !== 'undefined'
    && wx
    && wx.cloud
    && typeof wx.cloud.getTempFileURL === 'function';
}

function preferredImageSource(existingSrc, fileId, url) {
  const authorized = resolvedSource(existingSrc);
  if (authorized) return authorized;
  const resolvedFile = resolvedSource(fileId);
  if (resolvedFile) return resolvedFile;
  return resolvedSource(url);
}

async function resolveCloudFileIds(fileIds) {
  const unique = Array.from(new Set((fileIds || []).filter(isCloudFileId)));
  const missing = unique.filter((fileId) => !tempUrlCache[fileId]);
  if (!missing.length || !canUseCloudTempUrl()) return;
  try {
    const result = await wx.cloud.getTempFileURL({
      fileList: missing
    });
    (result.fileList || []).forEach((item) => {
      if (item.fileID && item.tempFileURL) tempUrlCache[item.fileID] = item.tempFileURL;
    });
  } catch (error) {
    console.warn('[energy-tree] getTempFileURL failed', error);
  }
}

function isSupportedImageSource(source) {
  if (typeof source !== 'string') return false;
  const value = source.trim();
  if (!value || /^(?:undefined|null|<[^>]*>)$/i.test(value)) return false;
  return /^(?:https?:\/\/|wxfile:\/\/|cloud:\/\/|\/)/.test(value);
}

function resolvedSource(source) {
  if (!isSupportedImageSource(source)) return '';
  const value = source.trim();
  if (isCloudFileId(value)) return tempUrlCache[value] || '';
  return value;
}

function avatarSource(user) {
  if (!user || typeof user !== 'object') return '';
  const candidates = [user.avatarSrc, user.avatarFileId, user.avatarUrl];
  for (const candidate of candidates) {
    const resolved = resolvedSource(candidate);
    if (resolved) return resolved;
  }
  return '';
}

function collectImageSources(value, result) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageSources(item, result));
    return;
  }
  if (typeof value !== 'object') return;
  [
    value.avatarFileId,
    value.photoFileId,
    value.photoPath,
    value.imageFileId,
    value.iconFileId
  ].forEach((source) => {
    if (isCloudFileId(source)) result.push(source);
  });
  Object.keys(value).forEach((key) => {
    const child = value[key];
    if (child && typeof child === 'object') collectImageSources(child, result);
  });
}

function decorateImageFields(value) {
  if (!value) return value;
  if (Array.isArray(value)) {
    value.forEach((item) => decorateImageFields(item));
    return value;
  }
  if (typeof value !== 'object') return value;

  const avatarSource = preferredImageSource(value.avatarSrc, value.avatarFileId, value.avatarUrl);
  if (avatarSource) value.avatarSrc = avatarSource;

  const photoSource = preferredImageSource(value.photoSrc, value.photoFileId, value.photoPath);
  if (photoSource) value.photoSrc = photoSource;

  const imageSource = preferredImageSource(value.imageSrc, value.imageFileId, value.imageUrl);
  if (imageSource) value.imageSrc = imageSource;

  const iconSource = preferredImageSource(value.iconSrc, value.iconFileId, value.iconUrl);
  if (iconSource) value.iconSrc = iconSource;

  Object.keys(value).forEach((key) => {
    const child = value[key];
    if (child && typeof child === 'object') decorateImageFields(child);
  });
  return value;
}

async function hydrate(value) {
  const fileIds = [];
  collectImageSources(value, fileIds);
  await resolveCloudFileIds(fileIds);
  return decorateImageFields(value);
}

module.exports = {
  avatarSource,
  decorate: decorateImageFields,
  hydrate,
  isCloudFileId,
  isSupportedImageSource,
  resolvedSource
};
