# 更新日志

版本号遵循语义化版本：`主.次.修订`。

## 1.7.5

- 补回 `repository` / `homepage` / `bugs`，让 npm 包与 GitHub 仓库重新关联（市场可显示下载量、跳转源码）
- `peerDependencies` 中 `@deepseek-ai/*` 增加显式预发布分支（`>=0.2.1-rc.3 <0.3.0-0 || >=0.3.0-rc.1`），避免未来 harness 预发布版本被 semver 静默排除而触发 `ERESOLVE`

## 1.7.4

- README 安装章节改为「从 npm 安装（推荐）」：直接对助手说安装 `dsh-copper-oil`，不再需要手填仓库地址
- 源码安装作为备选方式保留

## 1.7.3

- `assets` 不再进入 npm 包（截图仅在 GitHub 仓库显示），npm 包体积从 310 KB 降到约 4 KB

## 1.7.2

- 移除 `package.json` 中的 `repository` / `homepage` / `bugs`（不再在包内携带仓库账号信息）
- 删除 `PUBLISH.md`（个人发布笔记，不随包分发）
- README 的克隆示例改为通用写法
- 清理包目录内的本地 `.git`

## 1.7.1

- README 移除「CI 失败邮件」相关问答（属于 GitHub 账号设置，与插件无关）

## 1.7.0

- **包名改为 `dsh-copper-oil`**（原 `@local/copper-oil` 无法发布到 npm）；去掉 `"private": true`
- `cordis.patch.yml` 与 `client.js` 的模块 id 同步改名
- DSH 内部包（`@deepseek-ai/cordis`、`dsh-tools`、`dsh-host-webserver`）在 `peerDependenciesMeta` 中标记为可选，避免外部安装时因版本不匹配被拦
- 可直接 `npm publish` 上架插件市场（GitHub topic 建议加 `dsh-plugin`）

## 1.6.2

- README 重写：加入面板截图（`assets/screenshot.png`）、安装后效果说明、图例详解、交互表、Agent 用法示例与常见问题
- 测试命令改为 `node --test`（Node 20 不支持 `--test` 后接通配符，CI 之前因此失败）
- `package.json` 增加 `assets` 到 `files`

## 1.6.0

- 新增 `Config` 配置项：缓存时长、滞后网格（起止/步长）、滚动窗口、softmax 温度、是否注册 Agent 工具，均可在 `cordis.patch.yml` 覆盖
- 新增 `.gitignore`、`CHANGELOG.md`
- README 增加配置说明

## 1.5.0

- 补充 `LICENSE`（MIT，零点风研）与 `license` / `author` / `keywords` 元数据
- 声明 `engines.dsh` 与 `peerDependencies`
- 新增 `tests/smoke.test.mjs`（5 项冒烟测试）与 `npm test`

## 1.4.x

- 1.4.4 悬停读数补齐 5 / 10 / 20 三条区间
- 1.4.3 底部预留改为按「三线低点 → 扇形带下沿」的比例，铜油比同比例预留
- 1.4.2 轴按扇形带下沿预留，区间不再被截断；标题去掉「近一年：」
- 1.4.1 预测段低点改按三条预测线计算
- 1.4.0 双轴对齐由「起点同高」改为「高点齐顶、低点齐底」

## 1.3.x

- 1.3.9 对齐轴上下增加余量，避免预测低点贴边
- 1.3.8 滚轮缩放限定在绘图区与滑块，坐标轴/图例交还页面滚动
- 1.3.5 对齐判定改为「默认窗口及更窄区间沿用默认刻度」
- 1.3.1 增加「高低点对齐」开关（原「双轴同幅」）
- 1.3.0 纵轴随可见区间重算，修正窄窗口下轴范围发散（曾出现 −200）

## 1.2.x

- 1.2.1 四个读数按日涨跌着色（涨酒红 / 跌墨青），标题去掉「预测」
- 1.2.0 切换为纸面配色（奶油 `#F9F6E5` / 墨青 `#0E4258` / 酒红 `#992e34`），滚轴重做

## 1.1.0

- 补齐看板：双纵轴、近一年窗口、三层 P10–P90 扇形带、滚轮缩放/拖动/滑块、悬停读数、沪铜/原油双轴图、滞后分布 ρ 线

## 1.0.0

- 由早期 Python 版 `serve.py` + `index.html` 移植为 DSH 插件：Host 侧抓取计算并通过 `/copper-oil/api/data` 输出，Client 侧在侧边栏注册面板，另注册 `copper_oil_snapshot` 工具
