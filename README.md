# 小账本（个人记账 H5 应用）

一款在手机上使用、数据保存在本地的个人记账网页应用。

## 在线使用

- 网页版：<https://kim-zhengen.github.io/xiaozhangben/>（手机浏览器打开后可"添加到主屏幕"）
- 源码仓库：<https://github.com/KIM-zhengen/xiaozhangben>

## 如何打开

- 方式一：直接双击 `index.html`，用浏览器打开
- 方式二：在 `D:\jizhang` 目录打开终端，运行：

```powershell
python -m http.server 8000
```

然后浏览器访问 <http://localhost:8000>

## 在手机上使用

- **同一 WiFi 临时试用**：电脑启动服务器并允许局域网访问后，手机浏览器输入电脑局域网 IP（如 `http://192.168.1.5:8000`）
- **长期使用（推荐）**：把整个项目部署到任意静态网页托管（GitHub Pages、Netlify、Vercel、Gitee Pages 等），获得公开网址后手机随时访问
- **添加到主屏幕**：用手机浏览器打开网址后，通过"添加到主屏幕"即可像 App 一样使用
- **离线可用**：首次打开后静态文件会被缓存，之后离线也能打开查看（完整 PWA 功能需 HTTPS 或正式部署）

## 项目文档

- 需求文档：`docs/01-需求文档.md`
- 技术方案：`docs/02-技术方案.md`
- 设计规范：`docs/03-设计规范.md`
- 开发规范：`docs/04-开发规范.md`
- 执行步骤：`docs/05-执行步骤.md`
- 操作指引：`docs/06-操作指引.md`
- 开发日志：`devlog/`

## 技术说明

原生 HTML / CSS / JavaScript 构建，无构建工具；图表使用本地 ECharts（进入图表页时按需加载）；数据仅存本地（IndexedDB）；支持 PWA（manifest + Service Worker）离线缓存。
