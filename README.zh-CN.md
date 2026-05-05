# 80M Agent Desktop

<img width="100%" alt="80M Agent Desktop" src="docs/assets/80m-agent-hero.png" />

## 语言

- 英文：`README.md`
- 简体中文：`README.zh-CN.md`

> **80M Agent Desktop** 是本地 80M AI 工作区的原生桌面指挥中心：聊天、档案、记忆、工具、定时任务、Kanban 和网关自动化都集中在一个品牌化应用中。

## 安装

请从 [Releases](https://github.com/guapdad4000/80m-agent-desktop-v3/releases/) 页面下载最新构建版本。

| 平台  | 文件                  |
| ----- | --------------------- |
| Windows | `.exe`                |
| macOS | `.dmg`                |
| Linux | `.AppImage` 或 `.deb` |

> **macOS 用户：** 应用目前没有进行代码签名或 notarize，首次启动时 macOS 可能会阻止运行。安装后请执行：
>
> ```bash
> xattr -cr "/Applications/80m Agent Desktop.app"
> ```
>
> 或者右键应用，选择 **Open**，然后在弹窗中再次点击 **Open**。

## 功能包含

- 本地 80M 运行时的首次引导式安装，包含进度跟踪和依赖解析
- 多提供商支持 — OpenRouter、Anthropic、OpenAI、Google (Gemini)、xAI (Grok)、Qwen、MiniMax、Hugging Face、Groq，以及本地 OpenAI 兼容端点（LM Studio、Ollama、vLLM、llama.cpp）
- 基于 SSE 流式的聊天界面，带工具进度指示器、Markdown 渲染和语法高亮
- Token 使用量追踪 — 实时显示 prompt/completion token 数量和成本
- 会话管理 — SQLite FTS5 全文搜索、按日期分组的会话历史、恢复和搜索对话
- 档案切换 — 创建、删除和切换隔离的 80M 环境
- 14 个工具集 — web、browser、terminal、file、code execution、vision、image gen、TTS、skills、memory、session search、delegation、MoA 和任务规划
- 记忆系统 — 查看/编辑记忆条目、用户档案记忆、容量追踪
- 人格编辑器 — 编辑和重置 Agent 的 SOUL.md 个性文件
- 模型管理 — 跨提供商的模型配置 CRUD
- 定时任务 — Cron 任务构建器，支持 15 个投递目标
- Kanban 看板 — 创建、分配、阻塞、完成并检查多 Agent 任务，附带研究说明
- 16 个消息网关 — Telegram、Discord、Slack、WhatsApp、Signal、Matrix、Mattermost、Email (IMAP/SMTP)、SMS、iMessage、DingTalk、Feishu/Lark、WeCom、WeChat、Webhooks、Home Assistant
- 备份与导入 — Settings 中的完整数据备份/恢复
- 自动更新 — 自动检查和安装更新

## 预览

<table>
<tr>
<td width="50%" align="center"><b>80M 工作区</b><br/><img width="100%" alt="80M 工作区预览" src="docs/assets/80m-agent-preview.png" /></td>
<td width="50%" align="center"><b>ATM 吉祥物</b><br/><img width="100%" alt="80M ATM 吉祥物" src="docs/assets/atm-mascot-rich.png" /></td>
</tr>
<tr>
<td width="50%" align="center"><b>应用图标来源</b><br/><img width="100%" alt="80M ATM 应用图标" src="docs/assets/atm-mascot-icon-source.png" /></td>
<td width="50%" align="center"><b>80M 标识</b><br/><img width="100%" alt="80M 标识" src="docs/assets/80m-logo.png" /></td>
</tr>
</table>

## 工作方式

首次启动时，应用会：

1. 检查本地 80M 运行时是否已经安装。
2. 如果尚未安装，则运行运行时安装程序（需要 Git、uv、Python 3.11+）。
3. 提示你选择 API 提供商或本地模型端点。
4. 通过本地运行时配置文件保存提供商配置和 API Key。
5. 在设置完成后进入主工作区。

聊天请求会通过本地 API 服务器（`http://127.0.0.1:8642`）以 SSE 协议流式传输。桌面应用实时解析数据流，在到达时渲染工具进度、Markdown 内容和 Token 使用量。

## 开发

### 前置要求

- Node.js 和 npm
- Unix 类 shell 环境用于运行时安装程序（Linux/macOS；Windows 可通过 WSL 或 Git Bash）
- 下载运行时所需的网络访问

### 安装依赖

```bash
npm install
```

### 启动开发模式

```bash
npm run dev
```

### 运行检查

```bash
npm run lint
npm run typecheck
```

### 运行测试

```bash
npm run test
npm run test:watch
```

### 打包桌面应用

```bash
npm run build
```

平台打包：

```bash
npm run build:mac
npm run build:win    # 需要 wine（Linux/macOS）
npm run build:linux
```

## 技术栈

- **Electron** 39 — 跨平台桌面 shell
- **React** 19 — UI 框架
- **TypeScript** 5.9 — 主进程和渲染进程类型安全
- **Tailwind CSS** 4 — 实用优先样式
- **Vite** 7 + electron-vite — 快速开发服务器和构建工具
- **better-sqlite3** — 带 FTS5 全文搜索的本地会话存储
- **i18next** — 国际化框架
- **Vitest** — 测试运行器

## 许可证

80M Agent Desktop 采用 MIT 许可证。
