const TEXT_FIELDS_BY_ACTION = Object.freeze({
  bindAsSponsor: ['displayName'],
  bindByInvite: ['displayName'],
  updateProfile: ['name', 'nickname'],
  sendEncouragement: ['customMessage'],
  submitCheckIn: ['note'],
  reviewCheckIn: ['note'],
  requestWithdrawal: ['note'],
  processWithdrawal: ['note'],
  saveRewardItem: ['name', 'description'],
  verifyRedemption: ['note'],
  requestCancelRedemption: ['reason'],
  processCancelRedemption: ['note'],
  sendCoupleRequest: ['customRequestText']
});

function normalizedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function collectTextChecks(action, payload = {}) {
  if (action === 'sendCoupleMessage') {
    return payload.contentType === 'text' || !payload.contentType
      ? [normalizedText(payload.content)].filter(Boolean)
      : [];
  }
  const fields = TEXT_FIELDS_BY_ACTION[action] || [];
  return fields.map((field) => normalizedText(payload[field])).filter(Boolean);
}

function cloudFileId(value) {
  const fileId = normalizedText(value);
  return fileId.startsWith('cloud://') ? fileId : '';
}

function collectImageChecks(action, payload = {}) {
  const checks = [];
  if (action === 'updateProfile') {
    const fileId = cloudFileId(payload.avatarFileId);
    if (fileId) checks.push({ fileId, scene: 1 });
  } else if (action === 'submitCheckIn') {
    const fileId = cloudFileId(payload.photoFileId);
    if (fileId) checks.push({ fileId, scene: 4 });
  } else if (action === 'saveRewardItem') {
    const fileId = cloudFileId(payload.imageFileId);
    if (fileId) checks.push({ fileId, scene: 1 });
  } else if (action === 'sendCoupleMessage' && payload.contentType === 'image') {
    const fileId = cloudFileId(payload.imageFileId);
    if (fileId) checks.push({ fileId, scene: 2 });
  }
  return checks;
}

function makeSafetyError(code, message, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function rejectedError() {
  return makeSafetyError('CONTENT_SECURITY_REJECTED', '内容未通过安全检查，请修改后重试');
}

function unavailableError(cause) {
  return makeSafetyError('CONTENT_SECURITY_UNAVAILABLE', '内容安全服务暂时不可用，请稍后再试', cause);
}

function createContentSafetyService(options = {}) {
  const cloud = options.cloud;
  const logger = options.logger || console;

  function securityApi(name) {
    const api = cloud && cloud.openapi && cloud.openapi.security && cloud.openapi.security[name];
    if (typeof api !== 'function') throw unavailableError();
    return api;
  }

  async function assertTextAllowed({ content, openid, scene = 2 }) {
    let response;
    try {
      response = await securityApi('msgSecCheck')({
        content,
        version: 2,
        scene,
        openid
      });
    } catch (error) {
      if (error && String(error.code || '').startsWith('CONTENT_SECURITY_')) throw error;
      if (logger && typeof logger.warn === 'function') {
        logger.warn('[energy-tree] text content safety check unavailable', error && (error.errCode || error.code || error.message));
      }
      throw unavailableError(error);
    }
    const suggest = response && response.result && response.result.suggest;
    if (suggest === 'pass') return true;
    if (suggest === 'risky' || suggest === 'review') throw rejectedError();
    throw unavailableError();
  }

  async function resolveImageUrl(fileId) {
    if (!cloud || typeof cloud.getTempFileURL !== 'function') throw unavailableError();
    let response;
    try {
      response = await cloud.getTempFileURL({ fileList: [fileId] });
    } catch (error) {
      throw unavailableError(error);
    }
    const item = ((response && response.fileList) || []).find((entry) => (
      entry && entry.fileID === fileId && entry.tempFileURL && (entry.status === 0 || entry.status === undefined)
    ));
    if (!item) throw unavailableError();
    return item.tempFileURL;
  }

  async function submitImageCheck({ fileId, openid, scene }) {
    const mediaUrl = await resolveImageUrl(fileId);
    let response;
    try {
      response = await securityApi('mediaCheckAsync')({
        mediaUrl,
        mediaType: 2,
        version: 2,
        scene,
        openid
      });
    } catch (error) {
      if (error && String(error.code || '').startsWith('CONTENT_SECURITY_')) throw error;
      if (logger && typeof logger.warn === 'function') {
        logger.warn('[energy-tree] image content safety check unavailable', error && (error.errCode || error.code || error.message));
      }
      throw unavailableError(error);
    }
    if (!response || !response.traceId) throw unavailableError();
    return response.traceId;
  }

  async function assertEventAllowed({ action, payload = {}, openid }) {
    const trustedOpenid = normalizedText(openid);
    if (!trustedOpenid) throw unavailableError();
    const texts = collectTextChecks(action, payload);
    for (const content of texts) {
      await assertTextAllowed({ content, openid: trustedOpenid, scene: action === 'updateProfile' || action.startsWith('bind') ? 1 : 2 });
    }
    const imageChecks = [];
    for (const check of collectImageChecks(action, payload)) {
      const traceId = await submitImageCheck({ ...check, openid: trustedOpenid });
      imageChecks.push({ fileId: check.fileId, scene: check.scene, traceId });
    }
    return { imageChecks };
  }

  return {
    assertEventAllowed,
    assertTextAllowed,
    submitImageCheck
  };
}

module.exports = {
  collectImageChecks,
  collectTextChecks,
  createContentSafetyService
};
