# 情侣信笺云数据库部署清单

## 集合

- `coupleMessages`
- `coupleMessageInbox`
- `coupleMessageStates`
- `coupleMessageMigrations`

## 索引

在 `coupleMessageInbox` 创建复合索引：

1. `recipientOpenid` 升序
2. `sortKey` 降序

## 权限

按 `cloud-database-message-rules.json` 设置。客户端查询 `coupleMessageInbox` 和
`coupleMessageStates` 时必须显式包含 `recipientOpenid == 当前登录 openid`；所有写入均由
`energyTree` 云函数完成。

## 部署和迁移

1. 执行 `npm run sync:shared` 和 `npm run check:shared`。
2. 部署 `cloudfunctions/energyTree`，选择云端安装依赖且不上传 `node_modules`。
3. 调用 `bootstrapCoupleMessages` 两次；第二次 `createdCount` 必须为 `0`。
4. 调用 `queryCoupleMessages`、`sendCoupleMessage`、`markCoupleMessagesRead` 验证云端版本。
