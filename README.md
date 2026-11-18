# 报工助手 (Work Report Assistant)

一个移动端优先的**单页工时计时/报工提醒**小工具。纯前端、零依赖、数据全部保存在浏览器本地（localStorage），可直接部署到 GitHub Pages。

## 功能

- **型号管理**：为每种型号设置「工时定额（分钟）」。
- **开工计时**：选择型号 + 工件编号，一键开工，自动按工时定额计算「报工窗口」。
- **报工窗口浮动**：以工时为中心，前后各浮动可配置比例（默认 ±20%）。
  - 例：工时 100 分钟、浮动 20% → 最早第 80 分钟、最晚第 120 分钟可报工。
- **状态实时刷新**：等待报工 / 可报工 / 已超时，倒计时每秒更新。
- **自动提醒弹窗**：有工件进入报工窗口时自动弹出，支持「一键全报」。
- **已报工汇总**：按型号分组、统计今日累计工时。
- **一键跳转**：报工成功后自动跳转到配置的 URL（支持 `welink://` 等 URL Scheme）。
- **数据本地持久化**：刷新、关闭浏览器都不丢数据。

## 目录结构

```
.
├── index.html      # 页面结构
├── styles.css      # 样式（移动端优先）
├── app.js          # 全部逻辑（数据层 / 渲染 / 计时）
├── .nojekyll       # 让 GitHub Pages 不做 Jekyll 处理
└── README.md
```

## 本地预览

任选其一：

```bash
# Python
python3 -m http.server 8000
# 打开 http://127.0.0.1:8000

# Node
npx serve .
```

> 直接双击 `index.html` 也能用（纯静态、无后端）。

## 部署到 GitHub Pages

1. 新建一个 GitHub 仓库（例如 `work-report`）。
2. 把本目录所有文件推送到仓库的 `main` 分支：
   ```bash
   git init
   git add .
   git commit -m "feat: 报工助手初始版本"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/work-report.git
   git push -u origin main
   ```
3. 仓库 **Settings → Pages**：
   - Source 选 **Deploy from a branch**
   - Branch 选 **main**，目录选 **/ (root)**
   - 保存，等待 1~2 分钟。
4. 访问 `https://<你的用户名>.github.io/work-report/`。

> 因为入口是根目录的 `index.html`，无需任何构建步骤。

## 使用流程

1. 「📦 型号管理」里添加型号和工时定额。
2. 「📋 报工计时」选择型号、填工件编号，点「▶ 开工」。
3. 到达报工窗口时会自动提醒，点「✅ 报工」或「一键全报」。
4. 报工后自动跳转（需先在「⚙️ 设置」里配置跳转地址）。

## 说明

- 所有数据仅存于当前浏览器，换设备/清缓存会丢失，请勿用于需要长期留存的正式台账。
- 跳转地址的获取方式见应用内「📖 报工链接获取方式」教程。
