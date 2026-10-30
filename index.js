// 铜油比 · 上证指数预测看板 —— Host 半边。完全自包含：只依赖网络行情接口，不读取任何本地工程文件。
// 抓取（新浪 / 东方财富）与计算口径与早期 Python 版一致；历史在启动时由接口一次拉全。
// 通过 Harness 自身的 HTTP 服务暴露同源 JSON，并注册一个 Agent 可调用的工具。
export const inject = ['webServer', 'tools']

// 可在 cordis.patch.yml 的 config 里覆盖，字段默认值见 DEFAULT_SETTINGS。
// 不导出 Config schema：那需要 @deepseek-ai/schemastery，本插件坚持零依赖。
const CU_SYM = 'CU0'
const SC_SYM = 'SC0'
const SH_SYMBOL = 'sh000001'
const SH_SECID = '1.000001'
const MA_WINDOWS = [5, 10, 20]
const LIVE_LIMIT = 60

export const DEFAULT_SETTINGS = {
  cacheMinutes: 5,
  lagMin: 60,
  lagMax: 130,
  lagStep: 5,
  lagWindow: 250,
  lagTau: 0.15,
  enableTool: true,
}

const settings = { ...DEFAULT_SETTINGS, grid: [] }

function configure(config) {
  const c = config && typeof config === 'object' ? config : {}
  const num = (value, fallback, min, max) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback)
  settings.cacheMinutes = num(c.cacheMinutes, DEFAULT_SETTINGS.cacheMinutes, 1, 240)
  settings.lagMin = num(c.lagMin, DEFAULT_SETTINGS.lagMin, 20, 200)
  settings.lagMax = num(c.lagMax, DEFAULT_SETTINGS.lagMax, 40, 260)
  settings.lagStep = num(c.lagStep, DEFAULT_SETTINGS.lagStep, 1, 20)
  settings.lagWindow = num(c.lagWindow, DEFAULT_SETTINGS.lagWindow, 120, 1200)
  settings.lagTau = num(c.lagTau, DEFAULT_SETTINGS.lagTau, 0.01, 5)
  settings.enableTool = c.enableTool !== false
  const grid = []
  for (let L = settings.lagMin; L <= settings.lagMax; L += settings.lagStep) grid.push(L)
  settings.grid = grid.length >= 3 ? grid : [60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130]
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
const SINA_HEADERS = { 'User-Agent': UA, Referer: 'https://finance.sina.com.cn' }

// ---------- 基础工具 ----------
async function httpText(url, headers = {}, encoding = 'utf-8', timeout = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = await res.arrayBuffer()
    return new TextDecoder(encoding).decode(buffer)
  } finally {
    clearTimeout(timer)
  }
}

const round = (value, digits) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function mean(values) {
  let total = 0
  for (const value of values) total += value
  return values.length ? total / values.length : 0
}

function ma(arr, k, i) {
  return mean(arr.slice(Math.max(0, i - k + 1), i + 1))
}

function pstdev(values) {
  if (values.length === 0) return 0
  const m = mean(values)
  return Math.sqrt(mean(values.map((value) => (value - m) ** 2)))
}

function olsSlope(xs, ys) {
  const mx = mean(xs)
  const my = mean(ys)
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < xs.length; i += 1) {
    sxx += (xs[i] - mx) ** 2
    sxy += (xs[i] - mx) * (ys[i] - my)
  }
  return sxx ? sxy / sxx : 0
}

function corr(a, b) {
  if (a.length < 10) return 0
  const ma_ = mean(a)
  const mb = mean(b)
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < a.length; i += 1) {
    num += (a[i] - ma_) * (b[i] - mb)
    da += (a[i] - ma_) ** 2
    db += (b[i] - mb) ** 2
  }
  const den = Math.sqrt(da) * Math.sqrt(db)
  return den ? num / den : 0
}

function wquantile(pairs, q) {
  const sorted = [...pairs].sort((x, y) => x[0] - y[0])
  const total = sorted.reduce((sum, [, w]) => sum + w, 0)
  let acc = 0
  for (const [value, weight] of sorted) {
    acc += weight
    if (acc >= q * total) return value
  }
  return sorted[sorted.length - 1][0]
}

function futureTradingDays(lastDate, count) {
  const date = new Date(`${lastDate}T00:00:00Z`)
  const out = []
  while (out.length < count) {
    date.setUTCDate(date.getUTCDate() + 1)
    const weekday = date.getUTCDay()
    if (weekday !== 0 && weekday !== 6) out.push(date.toISOString().slice(0, 10))
  }
  return out
}

// ---------- 行情获取 ----------
async function fetchSinaRealtime() {
  const url = `https://hq.sinajs.cn/list=nf_${CU_SYM},nf_${SC_SYM}`
  let text
  try {
    text = await httpText(url, SINA_HEADERS, 'gbk', 15000)
  } catch {
    return {}
  }
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const match = /hq_str_nf_([A-Z0-9]+)="([^"]*)"/.exec(line)
    if (!match) continue
    const [, symbol, body] = match
    const cells = body.split(',')
    if (cells.length < 10) continue
    const date = cells.find((cell) => /^\d{4}-\d{2}-\d{2}$/.test(cell)) ?? ''
    const close = Number.parseFloat(cells[8])
    if (date && Number.isFinite(close) && close > 0) out[symbol] = { date, close }
  }
  return out
}

async function fetchSinaFuturesKline(symbol) {
  const url = `https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_${symbol}=/InnerFuturesNewService.getDailyKLine?symbol=${symbol}`
  let text
  try {
    text = await httpText(url, SINA_HEADERS, 'utf-8', 30000)
  } catch {
    return {}
  }
  const match = /=\((\[.*?\])\);?\s*$/s.exec(text) ?? /(\[\{.*\}\])/s.exec(text)
  if (!match) return {}
  try {
    const rows = JSON.parse(match[1])
    const out = {}
    for (const row of rows) if (row?.c != null) out[row.d] = Number.parseFloat(row.c)
    return out
  } catch {
    return {}
  }
}

async function fetchSinaIndex(datalen = 10) {
  const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${SH_SYMBOL}&scale=240&ma=no&datalen=${datalen}`
  try {
    const rows = JSON.parse((await httpText(url, SINA_HEADERS)).replace(/\n/g, ''))
    const out = {}
    for (const row of rows) out[row.day] = Number.parseFloat(row.close)
    return out
  } catch {
    return {}
  }
}

async function fetchTencentIndex() {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${SH_SYMBOL},day,,,${LIVE_LIMIT},qfq`
  try {
    const json = JSON.parse(await httpText(url))
    const data = json?.data?.[SH_SYMBOL] ?? {}
    const rows = data.qfqday ?? data.day ?? []
    const out = {}
    for (const row of rows) out[row[0]] = Number.parseFloat(row[2])
    return out
  } catch {
    return {}
  }
}

async function fetchEastmoneyIndex() {
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${SH_SECID}&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56&klt=101&fqt=0&beg=0&end=20500101&lmt=10000`
  try {
    const json = JSON.parse(await httpText(url))
    const rows = json?.data?.klines ?? []
    const out = {}
    for (const row of rows) {
      const cells = row.split(',')
      out[cells[0]] = Number.parseFloat(cells[2])
    }
    return out
  } catch {
    return {}
  }
}

async function fetchHistory() {
  const [cu, sc] = await Promise.all([fetchSinaFuturesKline(CU_SYM), fetchSinaFuturesKline(SC_SYM)])
  if (!Object.keys(cu).length || !Object.keys(sc).length) throw new Error('期货连续合约历史行情抓取失败')

  let sh = await fetchEastmoneyIndex()
  let shSource = Object.keys(sh).length ? 'eastmoney' : ''
  if (!shSource) {
    sh = await fetchSinaIndex(5000)
    shSource = Object.keys(sh).length ? 'sina' : ''
  }
  if (!shSource) {
    sh = await fetchTencentIndex()
    shSource = Object.keys(sh).length ? 'tencent' : ''
  }
  if (!shSource) throw new Error('上证指数历史行情抓取失败')

  const realtime = await fetchSinaRealtime()
  let appended = 0
  for (const [map, symbol] of [
    [cu, CU_SYM],
    [sc, SC_SYM],
  ]) {
    const quote = realtime[symbol]
    if (quote && !map[quote.date]) {
      map[quote.date] = quote.close
      appended += 1
    }
  }
  return { cu, sc, sh, source: appended ? `${shSource}+rt` : shSource }
}

// ---------- 计算 ----------
function lagWeights(n, R, sh) {
  const rhos = {}
  for (const L of settings.grid) {
    const xs = []
    const ys = []
    for (let t = Math.max(0, n - settings.lagWindow); t < n; t += 1) {
      if (t - L - 20 < 0) continue
      xs.push(Math.log(R[t - L] / R[t - L - 20]))
      ys.push(Math.log(sh[t] / sh[t - 20]))
    }
    rhos[L] = xs.length > 50 ? corr(xs, ys) : 0
  }
  const maxRho = Math.max(...Object.values(rhos))
  const weights = {}
  if (maxRho <= 0.02) {
    for (const L of settings.grid) weights[L] = 1 / settings.grid.length
  } else {
    let total = 0
    const raw = {}
    for (const L of settings.grid) {
      raw[L] = Math.exp(rhos[L] / settings.lagTau)
      total += raw[L]
    }
    for (const L of settings.grid) weights[L] = raw[L] / total
  }
  let eff = 0
  let variance = 0
  for (const L of settings.grid) {
    eff += L * weights[L]
    variance += weights[L] * (L - eff) ** 2
  }
  const pairs = settings.grid.map((L) => [L, weights[L]])
  const best = settings.grid.reduce((a, b) => (rhos[a] >= rhos[b] ? a : b))
  return {
    grid: settings.grid,
    rho: Object.fromEntries(settings.grid.map((L) => [String(L), round(rhos[L], 3)])),
    w: Object.fromEntries(settings.grid.map((L) => [String(L), round(weights[L], 4)])),
    eff: round(eff, 1),
    sd: round(Math.sqrt(variance), 1),
    p10: wquantile(pairs, 0.1),
    p90: wquantile(pairs, 0.9),
    best,
  }
}

function taper(L, j) {
  if (j >= L) return 0
  const start = 0.9 * L
  if (j <= start) return 1
  return (L - j) / (L - start)
}

function classify(vals, lastSh) {
  const net = vals[vals.length - 1] / lastSh - 1
  const changes = []
  for (let i = 1; i < vals.length; i += 1) changes.push(vals[i] / vals[i - 1] - 1)
  if (changes.length === 0) changes.push(0)
  const same = changes.filter((c) => (c > 0) === (net > 0)).length / changes.length
  const range = (Math.max(...vals) - Math.min(...vals)) / lastSh
  const vol = changes.length > 1 ? pstdev(changes) : 0
  const score = range ? Math.min(1, Math.abs(net) / range) : 0
  let kind
  if (Math.abs(net) < 0.02 && range < 0.06) kind = '震荡'
  else if (score >= 0.6 && same >= 0.55) kind = net > 0 ? '趋势上行' : '趋势下行'
  else kind = '混沌'
  return {
    end: round(vals[vals.length - 1], 2),
    net: round(net, 4),
    same: round(same, 3),
    range: round(range, 4),
    vol: round(vol, 5),
    score: round(score, 3),
    min: round(Math.min(...vals), 2),
    max: round(Math.max(...vals), 2),
    kind,
  }
}

function buildForecast(n, R, sh, futureDates, horizon, lw) {
  const lastSh = sh[sh.length - 1]
  const out = { dates: futureDates, metrics: {}, pred_end: {}, beta: {}, lag: lw }
  for (const k of MA_WINDOWS) {
    const paths = []
    const betas = {}
    for (const L of settings.grid) {
      const xs = []
      const ys = []
      for (let s = L; s < n - L; s += 1) {
        xs.push(Math.log(ma(R, k, s) / ma(R, k, s - L)))
        ys.push(Math.log(sh[s + L] / sh[s]))
      }
      const beta = Math.max(0.02, Math.min(0.5, olsSlope(xs, ys)))
      betas[L] = beta
      const anchor = n - 1 - L
      const base = ma(R, k, anchor) || R[anchor]
      const steps = Math.min(L, horizon)
      const vals = []
      for (let j = 0; j < steps; j += 1) vals.push(lastSh * (ma(R, k, n - L + j) / base) ** beta)
      paths.push([L, lw.w[String(L)], vals])
    }

    const line = []
    const p10 = []
    const p90 = []
    for (let j = 0; j < horizon; j += 1) {
      const pairs = []
      for (const [L, weight, vals] of paths) {
        if (j < vals.length) {
          const tw = weight * taper(L, j)
          if (tw > 0) pairs.push([vals[j], tw])
        }
      }
      if (pairs.length === 0) break
      const total = pairs.reduce((sum, [, w]) => sum + w, 0)
      line.push(round(pairs.reduce((sum, [v, w]) => sum + v * w, 0) / total, 2))
      p10.push(round(wquantile(pairs, 0.1), 2))
      p90.push(round(wquantile(pairs, 0.9), 2))
    }
    const metrics = classify(line, lastSh)
    metrics.beta = round(settings.grid.reduce((sum, L) => sum + lw.w[String(L)] * betas[L], 0), 3)
    out[`ma${k}`] = line
    out[`band${k}`] = { p10, p90 }
    out.pred_end[String(k)] = line[line.length - 1]
    out.metrics[String(k)] = metrics
    out.beta[String(k)] = metrics.beta
  }
  const labels = MA_WINDOWS.map((k) => out.metrics[String(k)].kind)
  const counts = new Map()
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1)
  const [bestLabel, bestCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  out.label = bestCount >= 2 ? bestLabel : '混沌'
  return out
}

async function buildPayload() {
  const live = await fetchHistory()
  const source = live.source
  const all = [...new Set([...Object.keys(live.cu), ...Object.keys(live.sc), ...Object.keys(live.sh)])].sort()
  const rows = all.map((d) => [d, live.cu[d], live.sc[d], live.sh[d]]).filter((x) => x[1] && x[2] && x[3])
  if (rows.length < 600) throw new Error(`可用交易日不足（${rows.length} 天），无法计算滞后分布`)
  const dates = rows.map((x) => x[0])
  const cu = rows.map((x) => x[1])
  const sc = rows.map((x) => x[2])
  const sh = rows.map((x) => x[3])

  const n = dates.length
  const R = cu.map((c, i) => round(c / sc[i], 4))

  const lw = lagWeights(n, R, sh)
  const effLag = Math.max(settings.grid[0], Math.min(settings.grid[settings.grid.length - 1], Math.round(lw.eff)))
  const horizon = effLag
  const futureDates = futureTradingDays(dates[n - 1], horizon)
  const forecast = buildForecast(n, R, sh, futureDates, horizon, lw)

  const RLead = R.map((_, i) => (i >= effLag ? R[i - effLag] : null))

  const meta = {
    start: dates[0],
    end: dates[n - 1],
    n,
    source,
    updated: new Date().toLocaleString('zh-CN', { hour12: false }),
    current_R: round(R[n - 1], 2),
    current_cu: round(cu[n - 1], 2),
    current_sc: round(sc[n - 1], 2),
    current_sh: round(sh[n - 1], 2),
    lead_td: effLag,
    future_td: horizon,
    forecast_end: futureDates[futureDates.length - 1],
    pred_end: forecast.pred_end,
    trend: forecast.label,
    lag: { eff: lw.eff, sd: lw.sd, p10: lw.p10, p90: lw.p90, best: lw.best, grid: lw.grid },
  }

  const ratioChart = RLead.map((x) => (x === null ? null : round(x, 2)))
  for (let j = 0; j < horizon; j += 1) ratioChart.push(round(R[n - effLag + j], 2))
  const shChart = sh.map((x) => round(x, 2))
  for (let j = 0; j < horizon; j += 1) shChart.push(null)

  return {
    start: dates[0],
    end: dates[n - 1],
    n,
    dates,
    chart_dates: [...dates, ...futureDates],
    close_cu: cu.map((x) => round(x, 2)),
    close_sc: sc.map((x) => round(x, 2)),
    close_sh: sh.map((x) => round(x, 2)),
    close_sh_chart: shChart,
    R: R.map((x) => round(x, 2)),
    ratio_chart: ratioChart,
    forecast: {
      dates: futureDates,
      ma5: forecast.ma5,
      ma10: forecast.ma10,
      ma20: forecast.ma20,
      band5: forecast.band5,
      band10: forecast.band10,
      band20: forecast.band20,
    },
    lag: lw,
    metrics: forecast.metrics,
    trend: forecast.label,
    meta,
  }
}

// ---------- 缓存 ----------
let cache = { at: 0, value: null, inflight: null }

async function getPayload(force = false) {
  const fresh = !force && cache.value && Date.now() - cache.at < settings.cacheMinutes * 60 * 1000
  if (fresh) return cache.value
  if (cache.inflight) return cache.inflight
  cache.inflight = (async () => {
    try {
      const value = await buildPayload()
      cache = { at: Date.now(), value, inflight: null }
      return value
    } catch (error) {
      cache.inflight = null
      throw error
    }
  })()
  return cache.inflight
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text),
  })
  res.end(text)
}

// ---------- 插件 ----------
export function apply(ctx, config) {
  configure(config)

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: '/copper-oil/api',
      handler: async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost')
          const payload = await getPayload(url.searchParams.get('refresh') === '1')
          sendJson(res, 200, payload)
        } catch (error) {
          sendJson(res, 502, { error: String(error?.message ?? error) })
        }
      },
    }),
  )

  if (!settings.enableTool) return
  ctx.effect(() =>
    ctx.tools.register({
      name: 'copper_oil_snapshot',
      description:
        '读取铜油比看板的最新读数：当前铜油比、上证指数、沪铜/原油连续价，滞后分布的有效滞后天数，未来走势分类，以及 5/10/20 日均线预测终点。用于回答“铜油比现在多少”“上证后面怎么走”这类问题。',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            asOf: { type: 'string' },
            source: { type: 'string' },
            current: {
              type: 'object',
              properties: {
                ratio: { type: 'number' },
                cu: { type: 'number' },
                sc: { type: 'number' },
                sh: { type: 'number' },
              },
            },
            leadTd: { type: 'number' },
            forecastEnd: { type: 'string' },
            trend: { type: 'string' },
            predEnd: { type: 'object', additionalProperties: true },
            metrics: { type: 'object', additionalProperties: true },
            lag: { type: 'object', additionalProperties: true },
            stale: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        render(_args, value) {
          return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
        },
      },
      async execute() {
        const payload = await getPayload()
        const meta = payload.meta
        return {
          asOf: meta.end,
          source: meta.source,
          current: {
            ratio: meta.current_R,
            cu: meta.current_cu,
            sc: meta.current_sc,
            sh: meta.current_sh,
          },
          leadTd: meta.lead_td,
          forecastEnd: meta.forecast_end,
          trend: meta.trend,
          predEnd: meta.pred_end,
          metrics: payload.metrics,
          lag: { eff: meta.lag.eff, p10: meta.lag.p10, p90: meta.lag.p90, best: meta.lag.best },
          stale: meta.source === 'base_only',
        }
      },
    }),
  )
}
