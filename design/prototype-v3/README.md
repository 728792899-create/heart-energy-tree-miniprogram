# 心动能量树 V3 产品原型

Figma 文件：[心动能量树 V3｜全量产品原型](https://www.figma.com/design/8jtVG6uk2Z45OhUXbqLHHX)

本目录保存 V3 高保真原型使用的原创设计源。业务代码、云函数、数据库结构、鉴权、事务、幂等和内容安全接口均未在本轮修改。

## 产品边界

- 固定两人私人版，不扩展公共匹配、多租户、排行榜或社交广场。
- 参与者与赞助者角色由云端可信 OPENID 判定，客户端不能自行改角色。
- 心愿金和奖励只表达为申请、确认与线下手动兑现，不接微信支付。
- 原型使用虚构数据，不包含 OPENID、邀请 token、二维码、真实头像或私人照片。

## Figma 页面

1. `00 — Cover`
2. `01 — Visual Exploration`
3. `02 — Foundations`
4. `03 — Components`
5. `04 — Participant`
6. `05 — Sponsor`
7. `06 — Shared & Letters`
8. `07 — States & Dialogs`
9. `08 — Responsive & Motion`
10. `09 — Handoff`

设计基础包含 7 个变量集合、100 个变量、9 个文字样式和 3 个效果样式。组件库包含 10 个变体集、22 个 Lucide 图标组件和 5 个业务卡片组件，共 99 个组件。

## 47 张业务画板

### 核心画板（23）

参与者：

1. 心动能量树（参与者首页）— `pages/home/home`
2. 建立两人关系 — `pages/bind/bind`
3. 足迹地图 — `pages/adventure-map/adventure-map`
4. 礼物 — `pages/shop/shop`
5. 情侣信笺 — `pages/messages/messages`
6. 我们 — `pages/profile/profile`
7. 编辑资料 — `pages/profile-edit/profile-edit`
8. 提交打卡 — `pages/checkin/checkin`
9. 能量币与心愿金 — `pages/wallet/wallet`
10. 打卡历史 — `pages/history/history`
11. 奖励详情 — `pages/reward-detail/reward-detail`
12. 兑换记录 — `pages/redemptions/redemptions`
13. 每周回顾 — `pages/weekly-recap/weekly-recap`

赞助者：

14. 陪伴管理（赞助者首页）— `pages/home/home`
15. 陪伴总览 — `pages/sponsor-companion/sponsor-companion`
16. 陪伴历史 — `pages/sponsor-companion-history/sponsor-companion-history`
17. 成长徽章 — `pages/sponsor-companion-badges/sponsor-companion-badges`
18. 陪伴明细 — `pages/sponsor-companion-ledgers/sponsor-companion-ledgers`
19. 兑换管理 — `pages/sponsor-companion-redemptions/sponsor-companion-redemptions`
20. 奖品管理 — `pages/admin-rewards/admin-rewards`
21. 打卡审核 — `pages/sponsor-review/sponsor-review`
22. 奖励与地图规则 — `pages/sponsor-rules/sponsor-rules`
23. 心愿金处理 — `pages/sponsor-payouts/sponsor-payouts`

### 关键弹层（8）

绑定确认、打卡提交、奖励兑换、兑换取消/核销、审核通过/退回、线下兑现确认、信笺请求响应、关系解除与数据删除。

### 系统状态（8）

加载、空数据、错误重试、弱网写入锁、权限受限、内容审核中/拒绝、媒体三级降级、异常账号恢复。

### 适配与动效（8）

- 320px 窄屏：参与者首页、赞助者首页、地图、审核页。
- 键盘弹起：信笺、资料编辑。
- 动效分镜：树木成长、里程碑与线下兑现庆祝。

## 五条可点击旅程

在 Figma 演示模式中可从以下起点进入；`09 — Handoff` 的五张旅程卡也已绑定到对应入口。

1. 绑定与云端角色分流
2. 参与者成长：打卡、审核、历史、周报、地图
3. 赞助者管理：审核、规则、奖品、线下兑现、明细
4. 信笺互动：撰写、请求响应、内容安全、完成
5. 个人与隐私：资料、记录、授权说明、关系解除、删除与恢复

## 原创素材

`assets/` 下共 12 张 JPEG，均为 1254×1254，单张小于 600 KB，合计 3,641,984 字节、低于 4 MB 文档预算，未进入小程序主包：

- `tree-stage-1.jpg` 至 `tree-stage-5.jpg`：双生种子到成熟心动树的五个连续生长阶段。
- `duo-binding.jpg`、`duo-growth.jpg`、`duo-celebration.jpg`：建立关系、共同成长与完成庆祝。
- `scene-checkin.jpg`、`scene-map.jpg`、`scene-reward.jpg`、`scene-protected-garden.jpg`：健康打卡、地图旅程、礼物兑现与受保护花园。

素材不含文字、真人、二维码、支付标识、水印或私人信息。

| 五阶段成长终态 | 固定两人共同成长 |
| --- | --- |
| ![两条路径汇聚为成熟的双生树](assets/tree-stage-5.jpg) | ![两条抽象路径围绕双生树共同生长](assets/duo-growth.jpg) |

| 健康行动 | 受保护的私人花园 |
| --- | --- |
| ![运动鞋与水壶构成的健康打卡场景](assets/scene-checkin.jpg) | ![树篱围合并保留双入口的私人花园](assets/scene-protected-garden.jpg) |

## ImageGen 提示词摘要

- 统一方向：晨雾植物志、象牙白纸张质感、鼠尾草绿与陶土色、水彩植物学插画、柔和自然光、克制留白。
- 双人关系：使用双生种子、交织树干、两条花园路径和抽象背影表达关系，不使用熊兔或真人形象。
- 连续成长：固定双种子与交织结构，从破土、幼苗、树冠成形到成熟花树，保证阶段可辨识。
- 业务场景：用步道、水壶、地图小径、礼物桌和树篱围合花园表达业务语义；明确排除硬币、支付界面、金融符号与文字。
- 安全约束：无文字、无 logo、无水印、无二维码、无真实人物、无私人照片或敏感标识。

## 实现注意事项

- 主视口为 390×844，同时保留 320px 窄屏与键盘弹起画板。
- 中文实现应使用苹方或系统字体；Figma 使用 Noto Sans SC 作为跨平台可编辑替代。
- 正文不低于 28rpx，辅助文字不低于 24rpx；关键触控区域不低于 88rpx。
- 动效保留远程 MP4 → 本地 poster → 原生静态三级降级；`reduced-motion` 直接显示目标阶段。
- 声音继续遵循关闭开关及其持久化状态。
- 余额、审核、关系、内容安全与线下兑现结果必须以云端权威状态为准。

## 已完成的 Figma 验收

- 47 张业务画板数量与分类准确。
- 22 条 `app.json` 路由全部覆盖；`pages/home/home` 含参与者与赞助者两个版本。
- 5 个原型起点、39 条交互反应，无断开的目标节点。
- 无缺失字体、重复画板 ID、关键触控区域不足或通用占位文案。
- 两张动效分镜已修正裁切，完整显示所有阶段、标题和说明。

以上为设计原型验收，不替代微信开发者工具编译、云函数部署、内容安全回调或双账号真机验收。
