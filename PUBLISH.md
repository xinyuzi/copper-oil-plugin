# 发布到 GitHub

仓库：<https://github.com/xinyuzi/copper-oil-plugin>（已创建，公开、空的，默认分支 `main`）

**关键约定：`package.json` 必须在仓库根目录**，不要把 `copper-oil/` 再套一层——这样别人
`git clone` 之后可以直接把克隆下来的目录交给 `install_bundle`，也能被插件市场当作包读取。

---

## 方式 A：装 Git 后命令行推送（推荐，后续可持续更新）

### 1. 安装 Git

```powershell
winget install --id Git.Git -e --source winget
```

装完**重开一个终端**，确认 `git --version` 有输出。

### 2. 在本目录（`copper-oil/`，含 `package.json` 的这一层）执行

```powershell
git init -b main
git add .
git commit -m "feat: copper-oil dashboard 1.6.1"

git remote add origin https://github.com/xinyuzi/copper-oil-plugin.git
git push -u origin main
```

首次 `push` 会弹出 GitHub 登录窗口（Git Credential Manager），登录 `xinyuzi` 账号授权即可。
如果没弹窗而是要求账号密码，密码处填 **Personal Access Token**（GitHub → Settings → Developer settings
→ Personal access tokens → Fine-grained tokens，权限勾 `Contents: Read and write`），不要填账号密码。

### 3. 之后每次更新

```powershell
git add .
git commit -m "fix: ..."
git push
```

---

## 方式 B：不装 Git，用网页上传

1. 打开 <https://github.com/xinyuzi/copper-oil-plugin/upload/main>
2. 把 `copper-oil` 文件夹里的**全部内容**（不是文件夹本身）拖进去：
   `index.js` `client.js` `cordis.patch.yml` `package.json` `README.md` `LICENSE`
   `CHANGELOG.md` `.gitignore` `icon.svg` `locale/` `tests/`
   > 拖文件夹时 Chrome/Edge 会保留子目录结构；`.gitignore` 是隐藏文件，需要在资源管理器里
   > 先勾选「显示隐藏的项目」，或单独用 “choose your files” 补传。
3. 提交信息写 `feat: initial release 1.6.1`，点 **Commit changes**。

缺点是每次更新都要手动重传。

---

## 发布后怎么验证

```powershell
# 在任意目录
git clone https://github.com/xinyuzi/copper-oil-plugin.git
cd copper-oil-plugin
node --test "tests/*.test.mjs"     # 6 项冒烟测试应全绿
```

然后在 DSH 里让助手安装本地插件，路径指向克隆下来的目录即可。

## 可选：加 CI

仓库里已带 `.github/workflows/test.yml`，推上去后每次 push 会自动跑那 6 项测试
（GitHub 仓库页 → Actions 标签页可看结果）。
