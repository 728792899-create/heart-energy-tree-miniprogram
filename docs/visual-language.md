# 视觉与动效设计说明

![心动能量树 V3 受保护私人花园](../design/prototype-v3/assets/scene-protected-garden.jpg)

心动能量树的视觉目标不是“把所有东西都做成粉色”，而是让一套涉及审核、账本和隐私的功能仍然显得温柔、可信、适合长期使用。

## 设计原则

### 1. 成长感，而不是催促感

进度通过树木、花园、地图和共同回顾呈现。界面避免使用倒计时、排行榜、损失厌恶和强刺激红点来迫使用户行动。

### 2. 浪漫感服从可读性

装饰使用纸张、植物、丝带和古金色，但正文保持足够对比度；小字号不低于当前约定的 20rpx，交互区域不低于 88rpx。

### 3. 庆祝只出现在关键时刻

普通点击不播放大型动效。绑定、首次打卡、审核通过、连续记录、地图通关、徽章、兑换和心愿完成才触发庆祝层。

### 4. 私人数据不成为装饰素材

周报、README、测试和发布证据都不使用真实照片。跨账号图片只有在关系鉴权后才能获得临时 URL。

## 核心色彩

| 语义 | 参考值 | 用途 |
| --- | --- | --- |
| Ivory / Cream | `#FBF7EF` | 页面背景、留白和安静区域 |
| Pearl | `#FFFDF8` | 卡片与输入表面 |
| Sage | `#748276` | 植物、成长和低刺激成功反馈 |
| Forest | `#294139` | 高对比标题和主要结构 |
| Dusty Rose | `#A85570` | 关系与情感强调 |
| Burgundy | `#6D2942` | 主要操作、仪式感和高权重文案 |
| Antique Gold | `#92743E` | 徽章、里程碑和少量装饰 |
| Midnight | `#111A2D` | 深色庆祝场景 |
| Ink | `#302D2A` | 正文 |
| Muted Ink | `#6D6862` | 次级说明，仍需满足可读性 |

实际小程序样式以 WXSS 为准；Figma 文件用于视觉协作，不能覆盖已经上线的可信业务规则。

## 抽象双人关系

V3 不再使用熊兔作为主角色。固定两人关系由双生种子、两条路径、交织树干和汇合花园表达，避免固化任何真实用户外貌。

| 建立关系 | 共同成长 | 完成庆祝 |
| --- | --- | --- |
| ![双生种子与两条路径建立关系](../design/prototype-v3/assets/duo-binding.jpg) | ![两条路径围绕双生树共同成长](../design/prototype-v3/assets/duo-growth.jpg) | ![交织树木与汇合路径表达完成庆祝](../design/prototype-v3/assets/duo-celebration.jpg) |

## 成长资产

五阶段树木保持双生种子、交织树干、纸张纹理与光照方向一致，使成长看起来是同一段关系持续变化，而不是五张无关插画。

| L1 | L2 | L3 | L4 | L5 |
| --- | --- | --- | --- | --- |
| ![V3 L1 双生种子破土](../design/prototype-v3/assets/tree-stage-1.jpg) | ![V3 L2 两株幼苗发芽](../design/prototype-v3/assets/tree-stage-2.jpg) | ![V3 L3 交织树干成长](../design/prototype-v3/assets/tree-stage-3.jpg) | ![V3 L4 双生树冠盛放](../design/prototype-v3/assets/tree-stage-4.jpg) | ![V3 L5 成熟心愿树](../design/prototype-v3/assets/tree-stage-5.jpg) |

## 粒子与庆祝符号

爱心、花瓣、星光和非金融化计数反馈只作为短暂状态提示。文档不再展示审核包中的旧运行时位图；后续 V3 运行时替换应优先复用抽象植物语言，并继续提供静态与 reduced-motion 兜底。

粒子只负责短暂反馈，不传达真实货币、收益或投资含义。

## V3 业务场景素材

V3 业务场景使用同一套晨雾植物志语言；它们是高保真原型与文档视觉，不冒充原生小程序截图。

| 打卡场景 | 花园场景 | 地图场景 | 兑换场景 |
| --- | --- | --- | --- |
| ![健康打卡场景](../design/prototype-v3/assets/scene-checkin.jpg) | ![受保护私人花园](../design/prototype-v3/assets/scene-protected-garden.jpg) | ![地图成长场景](../design/prototype-v3/assets/scene-map.jpg) | ![线下礼物兑现场景](../design/prototype-v3/assets/scene-reward.jpg) |

这些素材不包含真实人物、文字、二维码、支付标识、金融收益符号或水印。

## 页面截图规范

- 只从微信开发者工具原生模拟器或真机获取，不使用 Browser/Web 页面冒充小程序。
- 文档演示截图使用虚构 fixture，并明确标注“非双账号真机验收证据”。
- 固定 iPhone 12/13 视口，裁掉开发者工具外框、鼠标指针和编辑器区域。
- 不出现 OPENID、邀请 token、二维码、真实头像、私人照片、临时文件 URL 或聊天内容。
- PNG 单图控制在 180 KB 以内；文字必须在 GitHub 常用宽度下仍可辨认。

## 素材生产链

```mermaid
flowchart LR
  SOURCE["原创 ImageGen / Stitch 设计源"] --> REVIEW["人工筛选：无隐私、无水印、主题一致"]
  REVIEW --> CLEAN["本地清理：透明边缘、裁切、压缩"]
  CLEAN --> MINI["小程序 assets/generated"]
  CLEAN --> REMOTION["Remotion public/characters"]
  REMOTION --> POSTER["13 张本地 poster"]
  MINI --> BUDGET["主包与素材预算检查"]
  POSTER --> BUDGET
```

原始生成源保存在 `design/imagegen-source/`，运行时素材保存在 `miniprogram/assets/`。生成缓存和 Remotion `out/` 不进入 Git。

## 动效分级

| 等级 | 时长建议 | 用途 | reduced-motion |
| --- | --- | --- | --- |
| L1 | 90–160ms | 按压、切换和轻量反馈 | 直接更新状态 |
| L2 | 180–280ms | 卡片进入、内容展开 | 缩短或取消位移 |
| L3 | 220–600ms | 树木成长、徽章、兑换 | 使用静态 poster |
| L4 | 3–4s | 少量关键仪式视频 | 跳过 MP4，保留 poster |

任何场景都不能把视频作为唯一信息载体。视频失败必须回到 poster，poster 失败必须回到原生静止可读状态。

## 声音策略

项目只包含三种短音效：轻提示、成长反馈和承诺完成。声音默认遵循系统静音，用户关闭后持久保存；声音关闭不影响任何业务操作。

## 响应式与可访问性

- 全局盒模型限制横向溢出。
- 320/360px 等效窄屏具有明确回退布局。
- 原生按钮和 `role="button"` 交互区域统一不低于 88rpx。
- 输入区跟随键盘高度，不用固定视口减法猜测设备尺寸。
- 浅色次级文案使用经过收紧的深色 token。
- “简化动效”开关同时影响视频、庆祝层和循环动画。
- 所有远程数据页面都必须具备 loading、empty、error 和 retry 状态。

## Figma 当前边界

仓库记录的 Figma 文件包含 3 个物理页面、5 个变量集合、61 个变量、83 个组件根、8 个文字样式和 3 个效果样式。只读审计仍发现：

- 变量 scope 需要从 `ALL_SCOPES` 细化。
- 变量尚缺少 code syntax 映射。
- responsive/motion 交付区仍未完整写入。

因此 Figma 是待继续完善的设计协作源，不应被描述为已经完成的最终验收。对应可复现脚本位于 `design/figma/scripts/`。

## V3 原创素材来源

当前文档统一引用 `design/prototype-v3/assets/` 的 12 张原创 JPEG。提示方向为晨雾植物志、象牙白纸张、鼠尾草绿与陶土色，以双生种子、交织树干和两条路径表达固定两人关系；明确排除熊兔主角色、真人、文字、二维码、支付标识、金融符号与水印。

旧版熊兔文档插画和旧模拟器截图已从当前仓库移除。`miniprogram/assets/` 中审核包仍依赖的运行时兼容素材不作为 V3 文档展示；替换它们需要后续版本重新完成包体、动效降级、编译和微信审核。

## 验收入口

- UI 契约与素材质量：`npm test`
- 主包和素材预算：`npm run check:budgets`
- Remotion 场景发现：`npm run motion:compositions`
- Remotion 真实渲染：`npm run motion:smoke`
- 真机窄屏、键盘、弱网和 reduced-motion：[device-acceptance.md](device-acceptance.md)
