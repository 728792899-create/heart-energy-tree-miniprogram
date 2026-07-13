const { WITHDRAWAL_STATUS } = require('./cloudRuntimeModels');

function approve(request) {
  return {
    ...request,
    status: WITHDRAWAL_STATUS.APPROVED_WAITING_TRANSFER,
    approvedAt: new Date().toISOString()
  };
}

function markPaid(request, transferNote) {
  return {
    ...request,
    status: WITHDRAWAL_STATUS.PAID,
    transferNote: transferNote || '已由赞助者线下手动兑现',
    paidAt: new Date().toISOString()
  };
}

function reject(request, reason) {
  return {
    ...request,
    status: WITHDRAWAL_STATUS.REJECTED,
    rejectReason: reason || '这次先不领取，余额已退回账户',
    rejectedAt: new Date().toISOString()
  };
}

module.exports = {
  approve,
  markPaid,
  providerName: 'ManualPayoutProvider',
  reject
};
