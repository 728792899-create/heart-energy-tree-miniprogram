const { AMOUNT_LIMITS } = require('../core/models');
const rewardEngine = require('../core/rewardEngine');

function validateCents(value, limit, label) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    throw new Error(`${label}必须是整数分值`);
  }
  if (amount < limit.min || amount > limit.max) {
    throw new Error(`${label}必须在${rewardEngine.moneyText(limit.min)}到${rewardEngine.moneyText(limit.max)}之间`);
  }
  return amount;
}

function validateRewardRule(rule) {
  const normalized = rewardEngine.normalizeRule(rule);
  normalized.perCheckInCents = validateCents(normalized.perCheckInCents, AMOUNT_LIMITS.checkInReward, '单次打卡奖励');
  normalized.dailyMaxCents = validateCents(normalized.dailyMaxCents, AMOUNT_LIMITS.dailyMax, '每日现金上限');
  normalized.monthlyWishFundCents = validateCents(normalized.monthlyWishFundCents, AMOUNT_LIMITS.monthlyWishFund, '月度心愿基金');
  if (normalized.dailyMaxCents < normalized.perCheckInCents) {
    throw new Error('每日现金上限不能低于单次打卡奖励');
  }
  normalized.streakBonuses = (normalized.streakBonuses || []).map((bonus) => ({
    ...bonus,
    days: Number(bonus.days),
    bonusCents: validateCents(Number(bonus.bonusCents || 0), AMOUNT_LIMITS.streakBonus, '连续打卡奖励')
  }));
  return normalized;
}

function validateCheckInPhotoFileId(value, rel, state) {
  const photoFileId = String(value || '').trim();
  if (!photoFileId) throw new Error('请先上传运动打卡照片并提供文件 ID');
  if (state.meta && state.meta.cloudMode) {
    if (!photoFileId.startsWith('cloud://')) {
      throw new Error('云端打卡照片必须使用云文件 ID');
    }
    const relationshipPath = `/relationships/${rel.id}/checkins/`;
    if (!photoFileId.includes(relationshipPath)) {
      throw new Error('打卡照片必须位于当前关系的打卡目录');
    }
  }
  return photoFileId;
}

function validateOptionalDurationMinutes(value) {
  if (value === undefined || value === null || value === '') return null;
  const durationMinutes = Number(value);
  if (!Number.isFinite(durationMinutes) || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) {
    throw new Error('运动时长必须是 1–600 的整数分钟');
  }
  return durationMinutes;
}

function validateText(value, maxLength, label) {
  const text = String(value || '').trim();
  if (text.length > maxLength) throw new Error(`${label}不能超过 ${maxLength} 字`);
  return text;
}

function clientRequestIdFromInput(input = {}) {
  const clientRequestId = String(input.clientRequestId || '').trim();
  if (clientRequestId.length > 128) throw new Error('请求 ID 不能超过 128 个字符');
  return clientRequestId;
}

function validateNickname(name) {
  const value = String(name || '').trim();
  if (!value) throw new Error('昵称不能为空');
  if (value.length > 12) throw new Error('昵称最多 12 个字');
  return value;
}

function requireConfirmed(input, label, options = {}) {
  if (!input.confirmed) throw new Error(`${label}需要二次确认`);
  if (options.requireNote && !String(input.note || input.transferNote || input.reason || '').trim()) {
    throw new Error(`${label}需要填写备注`);
  }
}

function centsFromYuan(value) {
  return Math.round(Number(value || 0) * 100);
}

module.exports = {
  centsFromYuan,
  clientRequestIdFromInput,
  requireConfirmed,
  validateCents,
  validateCheckInPhotoFileId,
  validateNickname,
  validateOptionalDurationMinutes,
  validateRewardRule,
  validateText
};
