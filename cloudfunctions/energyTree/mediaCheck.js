const STATE_BACKED_MEDIA_ACTIONS = new Set(['submitCheckIn', 'updateProfile', 'saveRewardItem']);

function createMediaCheckHandlers(dependencies) {
  const {
    appService,
    cloud,
    createCloudMessageService,
    ensureCollections,
    getDb,
    loadCloudState,
    logger,
    nowIso,
    randomToken,
    runStateMutationTransaction
  } = dependencies;

  function findRelationshipIdForOpenid(state, openid) {
    const relationship = (state.relationships || []).find((item) => (
      item.sponsorOpenid === openid
      || item.participantOpenid === openid
      || (state.users || []).some((user) => (
        user.openid === openid && (user.id === item.sponsorId || user.id === item.participantId)
      ))
    ));
    return relationship ? relationship.id : '';
  }

  async function recordPendingMediaChecks(event, authContext, imageChecks, options = {}) {
    if (!Array.isArray(imageChecks) || !imageChecks.length) return [];
    const action = event && event.action;
    const backend = action === 'sendCoupleMessage'
      ? 'coupleMessage'
      : (STATE_BACKED_MEDIA_ACTIONS.has(action) ? 'state' : '');
    if (!backend) return [];

    const db = options.db || (cloud && typeof cloud.database === 'function' ? getDb() : null);
    if (!db) return [];
    if (!options.db) await ensureCollections();
    // Task ownership comes only from the trusted OPENID mapping, never a client relationshipId.
    const state = await loadCloudState(db);
    const relationshipId = findRelationshipIdForOpenid(state, authContext.openid);
    if (!relationshipId) throw new Error('找不到图片安全任务所属的情侣关系');

    const records = [];
    for (const check of imageChecks) {
      const data = {
        traceId: check.traceId,
        action,
        backend,
        openid: authContext.openid,
        relationshipId,
        fileId: check.fileId,
        scene: check.scene,
        status: 'pending',
        suggest: '',
        createdAt: nowIso(),
        resolvedAt: null
      };
      const response = await db.collection('mediaCheckTasks').add({ data });
      records.push({ ...data, _id: response && (response._id || response.id) });
    }
    return records;
  }

  function deriveMediaCheckSuggest(event) {
    const value = (event && event.result && event.result.suggest)
      || (event && Array.isArray(event.detail) && event.detail[0] && event.detail[0].suggest)
      || (event && Number(event.errcode) === 0 ? 'pass' : 'review');
    return String(value || 'review').toLowerCase();
  }

  function mediaCheckTraceId(event) {
    return String(
      (event && (event.trace_id || event.traceId))
      || (event && Array.isArray(event.detail) && event.detail[0]
        && (event.detail[0].trace_id || event.detail[0].traceId))
      || ''
    ).trim();
  }

  async function hideRiskyStateMedia(task, options = {}) {
    const db = options.db || getDb();
    return runStateMutationTransaction(db, async (state) => {
      let hiddenCount = 0;
      let relationshipId = task.relationshipId || '';
      (state.checkIns || []).forEach((checkIn) => {
        if (checkIn.photoFileId !== task.fileId) return;
        checkIn.photoFileId = '';
        checkIn.photoPath = '';
        checkIn.mediaHidden = true;
        relationshipId = relationshipId || checkIn.relationshipId || '';
        hiddenCount += 1;
      });
      (state.users || []).forEach((user) => {
        if (user.avatarFileId !== task.fileId) return;
        user.avatarFileId = '';
        user.avatarUrl = '';
        user.mediaHidden = true;
        const relationship = (state.relationships || []).find((item) => (
          item.sponsorId === user.id || item.participantId === user.id
        ));
        relationshipId = relationshipId || (relationship && relationship.id) || '';
        hiddenCount += 1;
      });
      (state.rewardItems || []).forEach((reward) => {
        if (reward.imageFileId !== task.fileId) return;
        reward.imageFileId = '';
        reward.imageUrl = '';
        reward.mediaHidden = true;
        relationshipId = relationshipId || reward.relationshipId || state.activeRelationshipId || '';
        hiddenCount += 1;
      });
      if (hiddenCount) {
        state.auditLogs = state.auditLogs || [];
        state.auditLogs.push({
          id: `audit_mediacheck_${Date.now()}_${randomToken().slice(0, 8)}`,
          relationshipId,
          actorOpenid: 'system:mediacheck',
          action: 'mediacheck.risky.autohide',
          targetId: task.fileId,
          amountCents: 0,
          note: task.action || '',
          createdAt: nowIso()
        });
        appService.saveState(state);
      }
      return { hiddenCount, relationshipId };
    });
  }

  async function handleMediaCheckResult(event, options = {}) {
    const traceId = mediaCheckTraceId(event);
    if (!traceId) return { ignored: true, reason: 'missing_trace_id' };
    const suggest = deriveMediaCheckSuggest(event);
    const db = options.db || getDb();
    if (!options.db) await ensureCollections();
    const found = await db.collection('mediaCheckTasks').where({ traceId }).limit(1).get();
    const task = found && found.data && found.data[0];
    if (!task || task.status !== 'pending') return { ignored: true, reason: 'already_resolved_or_unknown' };

    if (suggest === 'pass') {
      await db.collection('mediaCheckTasks').doc(task._id).update({
        data: { status: 'pass', suggest, resolvedAt: nowIso() }
      });
      return { status: 'pass', traceId };
    }

    let hiddenCount = 0;
    if (task.backend === 'coupleMessage') {
      const service = options.coupleMessageService || createCloudMessageService(db);
      const result = await service.hideMessageImageByFileId(task.relationshipId, task.fileId);
      const messageCount = Number(result && result.messageCount) || 0;
      const projectionCount = Number(result && result.projectionCount) || 0;
      hiddenCount = messageCount + projectionCount;
    } else {
      const result = await hideRiskyStateMedia(task, { db });
      hiddenCount = Number(result && result.hiddenCount) || 0;
    }

    const cloudClient = options.cloud || cloud;
    if (cloudClient && typeof cloudClient.deleteFile === 'function') {
      await cloudClient.deleteFile({ fileList: [task.fileId] })
        .catch((error) => logger.warn('[energy-tree] delete risky file failed', error && (error.errMsg || error.message)));
    }
    const status = hiddenCount ? 'risky' : 'orphan';
    await db.collection('mediaCheckTasks').doc(task._id).update({
      data: { status, suggest, resolvedAt: nowIso() }
    });
    return { status, traceId, hiddenCount };
  }

  return {
    handleMediaCheckResult,
    hideRiskyStateMedia,
    recordPendingMediaChecks
  };
}

module.exports = {
  createMediaCheckHandlers
};
