# Product

## Register

product

## Users

开发者在多个 AI 编码会话之间切换，可能暂时离开电脑，回来后需要快速知道哪些会话已经完成、哪些需要处理。

## Product Purpose

OpenCtrlC 是贴近终端、项目文件和现有工具的 AI coding agent 客户端。成功的体验是：用户可以并行运行多个会话，并且无需打开每个 tab 就能判断其当前状态。

## Brand Personality

克制、清晰、可靠。界面应优先服务于会话判断与代码工作流，反馈要明确但不能打断用户。

## Anti-references

避免把状态反馈做成持续闪烁、遮挡内容或依赖颜色才能理解的装饰；避免重复堆叠 toast、声音和强提示造成通知疲劳。

## Design Principles

- 状态靠近用户正在做决定的位置展示。
- 后台完成状态可保留，直到用户真正查看对应会话。
- 复用既有组件、语义颜色和通知生命周期，避免平行状态系统。
- 反馈应安静、可扫描，并为键盘和辅助技术提供等价信息。

## Accessibility & Inclusion

状态不能只依赖颜色；状态文案通过 tooltip 和可访问名称提供。动画需尊重 `prefers-reduced-motion`，文本与背景保持现有产品的对比度标准。
