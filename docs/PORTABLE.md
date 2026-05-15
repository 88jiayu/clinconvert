# Portable Build — 整包 ZIP 使用說明

> 編製：2026-05-15

## 是什麼

`clinconvert-portable-vX.X.zip` 是把 `dist/` build 結果整個壓縮起來的 portable 版本 ── **任何電腦解壓後、用 http server 跑、就有完整 clinconvert 功能**。

**用途**：
- 推甄面試現場：USB / 隨身碟帶著、教授電腦插上去就能 demo
- 內網部署：醫院 IT 內部跑、不上 cloud
- 離線備份：clinconvert.pages.dev 萬一掛了還能用

**大小**：~317 KB compressed / ~1 MB uncompressed
**位置（local）**：`D:\clinconvert\clinconvert-portable-v0.2.zip`（git 不入版控）

---

## 怎麼跑（3 種方式）

### 方式 1：Python（最簡單、Mac/Linux/Windows 都有）

```bash
# 解壓
unzip clinconvert-portable-v0.2.zip -d clinconvert-portable
cd clinconvert-portable

# 跑 server（Python 3）
python -m http.server 8000

# 開瀏覽器
# http://localhost:8000
```

### 方式 2：Node.js（裝過 npm 就有）

```bash
npx serve clinconvert-portable -p 8000
```

### 方式 3：直接拖到 Live Server / VS Code

VS Code 裝「Live Server」擴充套件 → 開資料夾 → 右鍵 index.html → Open with Live Server。

### ⚠️ 為什麼不能直接雙擊 index.html？

瀏覽器安全限制：
- Web Worker 必須走 HTTP/HTTPS、不能走 `file://`
- Service Worker（PWA）同樣需要 HTTP/HTTPS

→ **一定要起 http server**。Python / Node / Live Server 任一即可。

---

## 重新產生 ZIP

```bash
cd D:\clinconvert
npm run build
# 等 build 完
cd dist
powershell Compress-Archive -Path * -DestinationPath ../clinconvert-portable-v0.2.zip -Force
```

或在 Mac/Linux：
```bash
cd dist
zip -r ../clinconvert-portable-v0.2.zip .
```

---

## 包了什麼

```
clinconvert-portable-v0.2/
├── index.html              ← 中文首頁
├── en/index.html           ← 英文首頁
├── mapping-designer/index.html  ← 自訂範本設計工具
├── research/index.html     ← 研究 note + 解密工具
├── sample-data/            ← 3 個範例檔
│   ├── sample-patients.csv
│   ├── sample-kdigo-observations.csv
│   └── sample-exclincalc.json
├── _astro/                 ← JS / CSS / Web Worker
├── manifest.webmanifest    ← PWA manifest
├── sw.js                   ← Service Worker
├── favicon.ico / favicon.svg
```

**全部離線可用**（Service Worker 會把所有檔案 cache）。

---

## 對推甄面試的價值

```
教授：「demo 一下你的工具？」

你：「老師我有 USB、插進電腦、解壓 zip、跑一行
     `python -m http.server`、開瀏覽器 → 完整 clinconvert
     可以用、且沒網路也能用。」

→ 其他競品做不到的「面試現場零安裝 demo」、就靠這個。
```

---

## 進階：PWA 安裝

不需要 zip、更省事：

1. 開 https://clinconvert.pages.dev（或本地 http server）
2. Chrome / Edge 網址列右邊出現「**安裝為 app**」icon
3. 點下去 → 變成桌面圖示
4. 雙擊 → 像 native app 開（無瀏覽器 chrome）
5. **斷網也能用**（Service Worker 已 cache）

→ 比 zip 更輕、適合「自己用」場景。
