# 部署指南

本项目可以免费部署到 GitHub Pages 上。

## 🚀 部署到 GitHub Pages

### 方法一：使用 gh-pages（推荐）

#### 1. 准备工作

确保你已经有 GitHub 账号，并且本地已配置好 Git。

#### 2. 创建 GitHub 仓库

1. 访问 https://github.com/new
2. 创建新仓库，名称为 `evm-caller`
3. 不要初始化 README、.gitignore 或 LICENSE（因为本地已有）

#### 3. 配置项目

修改 `package.json` 中的 `homepage` 字段：
```json
"homepage": "https://你的GitHub用户名.github.io/evm-caller"
```

**例如**：如果你的用户名是 `siwei`，则改为：
```json
"homepage": "https://siwei.github.io/evm-caller"
```

#### 4. 初始化 Git 仓库并关联远程

```bash
# 初始化 Git（如果还没初始化）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit"

# 添加远程仓库（替换成你的用户名）
git remote add origin https://github.com/你的用户名/evm-caller.git

# 推送到 main 分支
git branch -M main
git push -u origin main
```

#### 5. 安装依赖并部署

```bash
# 安装依赖（包括 gh-pages）
npm install

# 构建并部署到 GitHub Pages
npm run deploy
```

#### 6. 启用 GitHub Pages

1. 访问你的仓库页面
2. 点击 `Settings` -> `Pages`
3. 在 `Source` 下，应该已经自动选择了 `gh-pages` 分支
4. 点击 `Save`
5. 等待几分钟，访问 `https://你的用户名.github.io/evm-caller`

### 方法二：使用 GitHub Actions（自动化部署）

#### 1. 创建 GitHub Actions 配置

创建文件 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    permissions:
      contents: write
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
        env:
          NODE_ENV: production
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

#### 2. 推送代码

```bash
git add .
git commit -m "Add GitHub Actions workflow"
git push
```

#### 3. 查看部署状态

1. 访问你的仓库
2. 点击 `Actions` 标签
3. 查看工作流运行状态
4. 部署完成后访问 `https://你的用户名.github.io/evm-caller`

## 🔄 更新部署

### 使用 gh-pages

每次修改代码后：

```bash
# 提交更改
git add .
git commit -m "你的更新说明"
git push

# 重新部署
npm run deploy
```

### 使用 GitHub Actions

只需推送代码，自动部署：

```bash
git add .
git commit -m "你的更新说明"
git push
```

## 📝 构建命令说明

### 本地构建

```bash
# 构建项目（生成 dist 目录）
npm run build

# 预览构建结果
npm run preview
```

构建产物在 `dist` 目录下，包含：
- `index.html` - 主页面
- `assets/` - CSS、JS、字体等资源

### 构建输出

```
dist/
├── index.html
└── assets/
    ├── index-[hash].js
    ├── index-[hash].css
    └── ...
```

## 🌐 自定义域名（可选）

如果你有自己的域名：

1. 在仓库根目录创建 `public/CNAME` 文件
2. 内容为你的域名，例如：`evm-caller.yourdomain.com`
3. 在域名提供商处添加 CNAME 记录指向 `你的用户名.github.io`
4. 重新部署

## 🎯 其他免费托管选项

### Vercel

1. 访问 https://vercel.com
2. 用 GitHub 账号登录
3. 导入仓库
4. 自动检测为 Vite 项目
5. 点击 Deploy

**优点**：
- 自动 HTTPS
- 全球 CDN
- 自动部署（推送代码即部署）
- 提供免费域名

### Netlify

1. 访问 https://netlify.com
2. 用 GitHub 账号登录
3. 点击 "New site from Git"
4. 选择仓库
5. 构建设置：
   - Build command: `npm run build`
   - Publish directory: `dist`
6. 点击 Deploy

**优点**：
- 自动 HTTPS
- 表单处理
- 函数支持
- 自动部署

### Cloudflare Pages

1. 访问 https://pages.cloudflare.com
2. 连接 GitHub 仓库
3. 构建设置：
   - Build command: `npm run build`
   - Build output: `dist`
4. 点击部署

**优点**：
- Cloudflare CDN
- 无限带宽
- 自动 HTTPS

## ⚠️ 注意事项

1. **路径配置**：确保 `vite.config.ts` 中的 `base` 配置正确
2. **环境变量**：敏感信息不要提交到 Git
3. **构建前测试**：先在本地 `npm run build && npm run preview` 测试
4. **浏览器缓存**：如果看不到更新，清除浏览器缓存或使用隐私模式

## 🐛 常见问题

### 1. 部署后页面空白

检查 `vite.config.ts` 的 `base` 配置：
- 如果仓库名是 `evm-caller`，base 应该是 `/evm-caller/`
- 如果使用自定义域名，base 应该是 `/`

### 2. 404 错误

确保 GitHub Pages 已启用，且选择了正确的分支（`gh-pages`）

### 3. 资源加载失败

检查浏览器控制台，确认资源路径是否正确

### 4. npm run deploy 失败

```bash
# 清除缓存重试
rm -rf node_modules package-lock.json
npm install
npm run deploy
```

## 📚 相关资源

- [GitHub Pages 文档](https://docs.github.com/en/pages)
- [Vite 部署文档](https://vitejs.dev/guide/static-deploy.html)
- [gh-pages 工具](https://github.com/tschaub/gh-pages)

