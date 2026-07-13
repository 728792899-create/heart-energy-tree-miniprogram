# 心动能量树架构说明

## 1. 客户端、云函数与数据层

```mermaid
flowchart TB
  subgraph CLIENT["微信小程序客户端"]
    PAGES["22 个原生页面"]
    COMPONENTS["共享组件与五栏导航"]
    API["services/api.js"]
    MEDIA["services/media.js"]
    LOCAL["Local Demo Adapter"]
  end

  subgraph CLOUD["energyTree 单云函数"]
    ENTRY["Action Dispatcher"]
    AUTH["getWXContext / Trusted OPENID"]
    SAFETY["Content Safety"]
    STATE_SERVICE["State Business Service"]
    MESSAGE_SERVICE["Couple Message Service"]
    HYDRATE["Authorized Media Hydration"]
  end

  subgraph DATA["微信云开发"]
    APPSTATE["appStates/main"]
    SNAPSHOTS["Users / Check-ins / Ledgers / Rewards / Audit Snapshots"]
    MESSAGES["coupleMessages / Inbox / States"]
    MEDIA_TASKS["mediaCheckTasks"]
    STORAGE["Cloud Storage"]
  end

  PAGES --> COMPONENTS --> API
  API -->|"cloud mode"| ENTRY
  API -->|"local demo only"| LOCAL
  ENTRY --> AUTH --> SAFETY
  SAFETY --> STATE_SERVICE
  SAFETY --> MESSAGE_SERVICE
  STATE_SERVICE --> APPSTATE
  STATE_SERVICE --> SNAPSHOTS
  MESSAGE_SERVICE --> MESSAGES
  SAFETY --> MEDIA_TASKS
  PAGES -->|"uploadFile"| STORAGE
  HYDRATE -->|"getTempFileURL"| STORAGE
  STATE_SERVICE --> HYDRATE
  MESSAGE_SERVICE --> HYDRATE
  HYDRATE --> API
  MEDIA --> PAGES
```

生产模式下，客户端只提交动作与业务参数。角色、用户和关系归属由云函数使用微信环境提供的 OPENID 解析，不能信任客户端传入的 `role`、`userId`、`sponsorId` 或 `openid`。

## 2. 授权动作处理时序

```mermaid
sequenceDiagram
  participant U as 微信用户
  participant C as 小程序客户端
  participant F as energyTree
  participant S as Content Safety
  participant D as Cloud Database
  participant M as Cloud Storage

  U->>C: 提交业务动作
  C->>C: 进行中锁 + clientRequestId
  C->>F: action + payload
  F->>F: getWXContext 获取可信 OPENID
  F->>D: 读取绑定关系与当前角色
  F->>S: 检查相关文字与图片
  alt 身份、权限或内容安全失败
    F-->>C: 稳定错误码与提示
  else 校验通过
    F->>D: 在事务内执行状态守护与业务变更
    D-->>F: 提交 appState 与快照变化
    F->>M: 为已授权媒体生成临时访问 URL
    F-->>C: data + buildTag
    C-->>U: 刷新业务状态
  end
```

查询与变更使用同一 API 边界。高权限动作还会校验赞助者角色；资金状态、审核、退款、核销和规则管理等变化写入 `auditLogs`。

## 3. 运动打卡、奖励与心愿金事务

```mermaid
flowchart LR
  UPLOAD["打卡者上传运动照片"] --> SUBMIT["提交打卡"]
  SUBMIT --> PENDING["SUBMITTED / 待确认奖励"]
  PENDING --> REVIEW{赞助者审核}
  REVIEW -->|"退回"| RETURNED["允许当天重新提交"]
  REVIEW -->|"通过"| TX["单文档事务"]

  TX --> LEDGER["能量币正式入账"]
  TX --> MAP["地图前进一步"]
  TX --> BADGE["徽章解锁"]
  TX --> MILESTONE["共同里程碑"]
  TX --> STREAK["连续记录更新"]

  LEDGER --> BALANCE["统一可用余额 cents"]
  BALANCE --> SHOP["奖励商店兑换"]
  BALANCE --> WISH["心愿金申请"]
  SHOP --> VERIFY["赞助者线下核销 / 退款"]
  WISH --> PAYOUT["赞助者线下兑现后标记"]
```

审核通过是入账、地图、徽章和里程碑生效的唯一入口。商店与心愿金共用同一余额，但系统不接充值、自动付款或微信支付；`1 能量币 = 1 元` 只是产品展示规则，底层始终使用 cents 记账。

## 4. 情侣信笺与实时状态

```mermaid
flowchart TB
  SEND["文字 / 单图 / 贴纸 / 问候 / 请求"] --> VALIDATE["关系鉴权 + 类型校验 + 内容安全"]
  VALIDATE --> MESSAGE["coupleMessages 主消息"]
  MESSAGE --> INBOX["coupleMessageInbox 收件投影"]
  INBOX --> WATCHER["前台 Watcher / 后台恢复"]
  WATCHER --> UI["消息方向 / 未读角标 / 动态滚动锚点"]

  UI --> RESPONSE{请求处理}
  RESPONSE --> ACCEPT["同意"]
  RESPONSE --> LATER["稍后"]
  RESPONSE --> DECLINE["婉拒"]
  RESPONSE --> CANCEL["撤回"]

  UI --> READ["markCoupleMessagesRead"]
  READ --> STATE["coupleMessageStates"]
```

自定义情侣请求保留“邀请不代表同意，双方都可以拒绝或改变主意”的同意提示。消息集合与 `appStates/main` 分离，避免实时信笺读写和核心业务单文档事务互相耦合。

## 5. 图片内容安全异步闭环

```mermaid
sequenceDiagram
  participant C as 客户端
  participant F as energyTree
  participant WX as 微信内容安全
  participant T as mediaCheckTasks
  participant D as 业务数据
  participant S as 云存储

  C->>S: 上传头像、打卡图、奖品图或信笺图
  C->>F: 提交 fileId
  F->>WX: mediaCheckAsync
  WX-->>F: traceId
  F->>D: 业务动作成功写入
  F->>T: 登记 traceId 与 fileId、关系和后端类型
  WX->>F: wxa_media_check 回调
  F->>T: 按 traceId 查询 pending 任务
  alt suggest 为 pass
    F->>T: 标记 pass
  else risky 或 review
    F->>D: 清空图片引用并标记 hidden
    F->>S: best-effort 删除风险文件
    F->>T: 标记 risky 或 orphan
    F->>D: 写入内容安全审计
  end
```

回调代码已经实现，但正式闭环仍依赖微信公众平台把 `wxa_media_check` 结果路由到 `energyTree`，并完成真机风险图验证。详见 [`content-safety-closed-loop.md`](content-safety-closed-loop.md)。

## 6. 共享代码、防漂移与发布边界

```mermaid
flowchart LR
  SOURCE["miniprogram/ 下 6 个共享主版文件"] --> SYNC["npm run sync:shared"]
  SYNC --> COPY["cloudfunctions/energyTree 部署副本"]
  SOURCE --> CHECK["npm run check:shared"]
  COPY --> CHECK
  SOURCE --> TEST["npm test"]
  COPY --> TEST

  CLIENT_TAG["miniprogram/config/env.js"] --> TAGCHECK["buildTag 一致性"]
  CLOUD_TAG["cloudfunctions/energyTree/index.js"] --> TAGCHECK
  README_TAG["README 当前交付状态"] --> TAGCHECK
  TAGCHECK --> DEPLOY["人工上传并部署云函数"]
  DEPLOY --> VERIFY["真实 queryDashboard 响应核验"]
```

- 云端副本由同步脚本生成，不能把两份共享代码当成独立源文件手工维护。
- 本地客户端日志只能证明本地配置，不能证明线上云函数已部署；最终以真实云函数响应的 `buildTag` 为准。
- 文档、测试和代码准备完成不等于正式发布。全量发布、平台消息推送配置和双账号真机验收仍属于需要人工确认的外部操作。
