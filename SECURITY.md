# Security Policy

## Supported release

安全修复只针对 `main` 上的私人版 V2。该仓库不提供公共多租户服务，也不支持真实支付。

## Reporting a vulnerability

请优先使用 GitHub 仓库的 **Security → Report a vulnerability** 私密通道。报告中提供受影响 commit、可复现步骤、预期/实际结果和最小化测试数据；不要提交真实 OPENID、邀请 token、二维码、云环境凭据、Cookie、私人照片或数据库导出。

不要通过公开 issue 发布可利用细节或秘密。维护者确认前，不要在真实云数据上运行破坏性验证。

## Security boundaries

- 生产身份只来自 `getWXContext().OPENID`。`__testOpenid` 仅在 `NODE_ENV=test` 且显式测试开关开启时有效。
- 所有业务写入经过 `energyTree` 云函数；客户端集合写权限必须关闭。
- 余额、审核、退款、核销、规则和手动兑现状态使用事务、角色校验、幂等请求和审计日志。
- 用户文字和图片在业务写入前进入内容安全检查；异步图片回调失败时不得伪装成已通过。
- 临时媒体 URL 只在关系鉴权后签发，不持久化为公共 URL。
- 邀请 token、OPENID、二维码、照片、数据库导出、private config、依赖目录和渲染缓存不得提交。

## Dependency note

云函数锁定微信官方最新 `wx-server-sdk@4.0.2`。截至本次审查，`npm audit` 对其上游 `@cloudbase/node-sdk` 依赖树报告高危/中危传递项，npm 只给出降级到旧主版本的建议，官方 latest 仍为 4.0.2。当前仓库保持官方 latest 和精确 lock/integrity，CI 验证干净安装；发布人员需持续复查官方更新。未经兼容测试不要强行 override `axios`/`lodash`，也不要把已知风险描述为已消除。
