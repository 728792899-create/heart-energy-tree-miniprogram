# 运动能量树 API 契约

当前实现使用 `miniprogram/services/api.js` 作为页面和云函数之间的边界。小程序端默认调用 `energyTree` 云函数，本地 demo 模式仅用于开发调试，不直接改页面业务流。

生产写操作必须由云函数根据服务端可信 openid 构造 `authContext`。前端传入的 `role`、`userId`、`sponsorId`、`openid` 只能作为展示数据，不能作为权限依据。

## 用户与关系

- `login()` / `queryDashboard()`
  - 云函数从微信环境获取可信 `OPENID`。
  - 未绑定用户返回 `needsBinding=true`，前端跳转到绑定页。
- `bindAsSponsor({ displayName })`
  - 第一位进入的人创建情侣能量树，绑定当前 `OPENID` 为赞助者。
- `generatePartnerInvite()`
  - 赞助者生成小程序分享路径，路径内包含云端邀请 token。
- `bindByInvite({ inviteToken, displayName })`
  - 另一半从小程序分享卡片进入后，用邀请 token 绑定当前 `OPENID` 为打卡者。
  - 已绑定身份不能被其他 `OPENID` 抢占；绑定成功后会轮换邀请 token。
- `switchRole(role)`
  - 仅用于本地 demo 演示，正式版由云函数 openid 和服务端 relationship 权限决定。
- `queryDashboard()`
  - 返回当前关系、余额、成长树、探险地图摘要、统计、今日打卡、待审核数、待处理心愿金数、徽章和日历摘要。
- `queryAdventure()`
  - 返回关卡列表、当前关卡、进度百分比和剩余步数。
- `queryBadges()` / `queryCalendarStats()`
  - 返回徽章墙和月度打卡日历。

## 打卡与审核

- `uploadCheckInPhoto({ relationshipId, filePath })`
  - 小程序端先上传到云存储，返回 `fileID`。
- `uploadCheckIn({ relationshipId, photoFileId, note, durationMinutes })`
  - 创建 `submitted` 打卡。
  - 同一关系、同一打卡者、同一天只能有一条 `submitted/approved` 打卡；`rejected` 后可重新提交。
  - 正式版只提交云存储 `fileID`，不信任前端本地临时路径。
- `reviewCheckIn({ checkInId, decision, note })`
  - `decision=approved` 时才会写入奖励流水、增加余额、更新成长树、推进探险地图、触发徽章和彩蛋。
  - `decision=rejected` 只更新打卡状态和退回说明，不改变余额。
  - 只能由 relationship 的 sponsor openid 执行。

## 探险、徽章与商店

- `queryRewardItems({ category, includeInactive })`
  - 女友端默认只返回上架奖励；男友管理端可传 `includeInactive=true`。
- `queryRewardItem(id)`
  - 返回奖品详情、价格、库存和上下架状态。
- `redeemReward({ relationshipId, rewardId })`
  - 校验余额、库存和上下架状态，扣减可用余额，生成待使用兑换券和兑换流水。
- `queryRedemptions()` / `verifyRedemption({ redemptionId, note })`
  - 查询兑换券；男友线下兑现后将 `pending` 核销为 `used`；核销必须 `confirmed=true` 且填写备注。
- `requestCancelRedemption({ redemptionId, reason })`
  - 打卡者申请取消待使用兑换券，状态从 `pending` 变为 `cancel_requested`。
- `processCancelRedemption({ redemptionId, action, note, confirmed })`
  - 赞助者可确认退款，状态变为 `cancelled_refunded`，退回余额并恢复有限库存。
  - 赞助者可拒绝取消，状态回到 `pending`，并记录拒绝原因。
- `saveRewardItem()` / `toggleRewardItem()`
  - 男友端新增奖励或上下架奖励。

## 余额与心愿金领取

- `requestWithdrawal({ relationshipId, amountCents, note })`
  - 校验可用余额，创建心愿金领取申请，并把金额从可用余额转入冻结余额。
  - 只能由 relationship 的 participant openid 执行。
- `processWithdrawal({ withdrawalId, action, note })`
  - `approve`：进入等待手动兑现。
  - `mark_paid`：赞助者线下兑现后标记完成，冻结余额转入已兑现；必须 `confirmed=true` 且填写备注。
  - `reject`：退回申请，冻结余额回到可用余额；必须 `confirmed=true` 且填写原因。
  - 第一版不接入平台付款接口，也不提供金融服务。

## 奖励规则

- `updateRewardRule({ relationshipId, rule })`
  - 修改每次奖励、每日上限、月度心愿基金目标和连续打卡奖励。
  - 现金奖励必须确定可解释；随机惊喜仅用于非现金权益。

## 不变量

- 页面不能直接修改余额。
- 审核通过是奖励入账、地图前进、徽章解锁的唯一入口。
- 最终关卡通关奖励只发一次。
- 商店兑换会扣减同一套可领取心愿金余额，兑换券核销不能重复扣款。
- 心愿金领取只通过状态机改变余额：申请冻结、兑现出账、拒绝退回。
- 每笔奖励和心愿金领取都必须归属到 `relationshipId`，避免多人使用时串账。
- 所有高权限和资金状态变更都必须写审计日志。
