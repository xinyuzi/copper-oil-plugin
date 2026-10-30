# 铜油比看板 · Harness 插件

> **本插件完全自包含。** 安装只需本目录，不需要 `npm install` / `pnpm`，不需要解压其他压缩包，
> **也不依赖任何旧工程**（`tyb_auto_v2.1` 只是早期 Python 版的名字，仅作历史说明，运行时不读取它）。
> 安装方式：用 `plugin_manager` 工具，`action: install_bundle`，`target` 指向本目录的绝对路径。

沪铜连续 ÷ 原油连续 得到铜油比，按 60~130 个交易日的滞后分布对齐上证指数，
再用多条均线路径外推未来同样长度的交易日。

## 与早期 Python 版的关系（仅作对照，不是依赖）

| 旧文件 | 现在在哪 | 说明 |
|---|---|---|
| `serve.py` 的抓取 | `index.js` 的 `fetchHistory()` | Node 自带 `fetch`，新浪期货日 K + 东方财富指数日 K |
| `serve.py` 的计算 | `index.js` 的 `lagWeights()` / `buildForecast()` | 公式与参数原样保留 |
| `serve.py` 的 `/api/data` | `index.js` 注册的 `/copper-oil/api` 路由 | 与页面同源，不占端口、无 CORS |
| `index.html` + ECharts | `client.js` 的 `Panel` | React + 自绘 SVG |
| `base.json` | 已移除 | 历史由行情接口一次拉全（2018-03-26 起），本目录内没有该文件 |
| `launch.bat` / `update.bat` / `serve.port` | 已移除 | 进程内运行，随 Harness 启停 |

## 数据链路

```
行情接口 ──► index.js 抓取对齐计算（内存缓存 5 分钟）
                ├── GET /copper-oil/api/data ──► client.js 面板（fetch 同源）
                └── tool copper_oil_snapshot ──► Agent 直接查询
```

## 面板功能（与原看板对齐）

- 读数：当前铜油比、上证指数、沪铜连续、原油连续、数据末日
- 主图：**双纵轴**（左铜油比、右上证，按「高低点对齐」），默认近一年；5/10/20 日均线预测 + 各自 P10–P90 扇形带；**滚轮缩放、拖动平移、底部滑块选区**；悬停十字线显示当日读数与三条区间；标注预测起点
- 沪铜 / 原油：双纵轴价格图，可缩放平移
- 走势预估：三条曲线的终点、净变动、方向一致度、弹性 β、类型，以及文字结论
- 滞后分布：权重柱 + 相关性 ρ 线（双轴），悬停查看单个滞后的权重与 ρ
- 预测值列表：逐日 5/10/20 日均线预测
- 计算口径与免责声明

## 使用

- **面板**：刷新 Web 页面后，左侧边栏出现图表图标，点开即看；旧入口「铜油比」标签。
- **对话**：直接问「现在铜油比多少、上证后面怎么走」，Agent 会调用 `copper_oil_snapshot`。
- **刷新**：面板右上角「立即刷新」，或每 5 分钟自动刷新一次。

## 配置

在 `cordis.patch.yml` 的 `config` 里覆盖，全部可选：

| 字段 | 默认 | 说明 |
|---|---|---|
| `cacheMinutes` | `5` | 行情缓存时长（分钟） |
| `lagMin` / `lagMax` / `lagStep` | `60` / `130` / `5` | 滞后候选网格（交易日） |
| `lagWindow` | `250` | 估计滞后相关性用的滚动窗口 |
| `lagTau` | `0.15` | 滞后权重 softmax 温度，越小越集中 |
| `enableTool` | `true` | 是否注册 `copper_oil_snapshot` 工具 |

```yaml
- insert:
    - id: copper-oil
      name: '@local/copper-oil'
      config:
        cacheMinutes: 10
        enableTool: false
```

## 开发

```bash
node --test "tests/*.test.mjs"   # 冒烟测试：manifest / patch / 图标 / Host 注册 / Client 注册 / Config
```

测试只依赖 Node 内置模块，不需要安装任何依赖。

- 许可证：MIT（见 `LICENSE`）
- 兼容性：`engines.dsh` 声明了最低 Harness 版本，`peerDependencies` 列出了运行时依赖
- 变更记录：`CHANGELOG.md`

## 更新

改完工作区里的文件后重新执行 `plugin_manager` 的 `install_bundle`（`target` 指向本目录），
再刷新页面。Host 侧改动需要重启 Harness 才能加载新的 JS 模块。

## 口径与免责

预测 = 各滞后路径按相关性 softmax 加权后的中位数，区间取加权 P10–P90；
未来交易日按工作日推算，未剔除法定节假日。仅供研究参考，不构成投资建议。
