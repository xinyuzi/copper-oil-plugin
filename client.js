// 铜油比 · 上证指数预测看板 —— Client 半边。
// 配色：奶油纸底 #F9F6E5、墨青 #0E4258、酒红 #992e34。
// 主图：双纵轴（左铜油比 / 右上证）、三层 P10–P90 扇形带、滚轮缩放、拖动平移、
// 带缩略走势的底部滑块（拖窗口 / 拖两端 / 点轨道跳转 / 双击复位）。
window.__ModuleLoader__.load({
  id: '@local/copper-oil',
  factory(require) {
    const React = require('react')
    const { useState, useEffect, useRef, useMemo } = React
    const h = React.createElement

    // ---------- 主色 ----------
    const PAPER = '#F9F6E5'
    const CARD = '#FFFDF4'
    const INK = '#0E4258'
    const OX = '#992e34'
    const BRASS = '#8B6B3E'
    const ink = (alpha) => `rgba(14,66,88,${alpha})`
    const ox = (alpha) => `rgba(153,46,52,${alpha})`

    const C = {
      sh: INK,
      ratio: OX,
      cu: OX,
      sc: INK,
      m5: '#4C7385',
      m10: '#7E9AA8',
      m20: '#A9BCC5',
      band5: '#4C7385',
      band10: '#7E9AA8',
      band20: '#A9BCC5',
      bar: INK,
      rho: OX,
    }

    const KIND = {
      趋势上行: { fg: OX, bg: ox(0.1) },
      趋势下行: { fg: INK, bg: ink(0.1) },
      震荡: { fg: BRASS, bg: 'rgba(139,107,62,0.12)' },
      混沌: { fg: ink(0.72), bg: ink(0.06) },
    }
    const kindOf = (kind) => KIND[kind] ?? KIND['混沌']

    const CSS = `
    .co-root { height:100%; min-height:100%; overflow:auto; background:${PAPER}; color:${INK}; }
    .co-wrap { max-width:1280px; margin:0 auto; padding:22px 24px 44px; }
    .co-head { display:flex; align-items:flex-start; gap:16px; margin-bottom:14px; }
    .co-title { font-size:21px; font-weight:600; letter-spacing:.3px; }
    .co-ref { margin-left:6px; font-size:12px; font-weight:400; letter-spacing:0; color:${ox(0.78)};
      text-decoration:none; border-bottom:1px solid ${ox(0.35)}; }
    .co-ref:hover { color:${OX}; border-bottom-color:${OX}; }
    .co-sub { margin-top:6px; font-size:12px; line-height:1.75; color:${ink(0.62)}; max-width:1010px; }
    .co-btn { margin-left:auto; flex:none; padding:6px 14px; border-radius:7px; font-size:13px; letter-spacing:.3px;
      border:1px solid ${ink(0.35)}; background:${CARD}; color:${INK}; cursor:pointer; transition:background .15s,color .15s; }
    .co-btn:hover { background:${INK}; color:${PAPER}; border-color:${INK}; }
    .co-btn:disabled { opacity:.55; cursor:default; }
    .co-kpis { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:14px; }
    .co-kpi { flex:1 1 140px; background:${CARD}; border:1px solid ${ink(0.14)}; border-radius:9px; padding:10px 14px; }
    .co-kpi .v { font-size:19px; font-weight:600; font-variant-numeric:tabular-nums; letter-spacing:.2px; }
    .co-kpi .l { margin-top:3px; font-size:11.5px; color:${ink(0.58)}; }
    .co-kpi.accent .v { color:${OX}; }
    .co-card { background:${CARD}; border:1px solid ${ink(0.14)}; border-radius:9px; padding:14px 16px; margin-bottom:14px;
      box-shadow:0 1px 2px ${ink(0.05)}; }
    .co-card-h { display:flex; align-items:baseline; gap:10px; margin-bottom:8px; }
    .co-toggle { margin-left:auto; display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:999px;
      font-size:11.5px; border:1px solid ${ink(0.25)}; background:transparent; color:${ink(0.62)}; cursor:pointer; }
    .co-toggle:hover { border-color:${ink(0.5)}; color:${ink(0.85)}; }
    .co-toggle.on { border-color:${OX}; color:${OX}; background:${ox(0.07)}; }
    .co-toggle-box { display:inline-block; width:12px; height:12px; line-height:11px; text-align:center; border:1px solid currentColor;
      border-radius:3px; font-size:10px; }
    .co-card-t { font-size:14px; font-weight:600; letter-spacing:.2px; }
    .co-card-s { font-size:12px; color:${ink(0.55)}; }
    .co-hint { margin-top:8px; font-size:11.5px; line-height:1.7; color:${ink(0.5)}; }
    .co-chart { position:relative; width:100%; }
    .co-tip { position:absolute; pointer-events:none; z-index:5; min-width:150px; padding:8px 10px; border-radius:7px; font-size:12px;
      line-height:1.65; background:${CARD}; border:1px solid ${ink(0.22)}; box-shadow:0 6px 20px ${ink(0.12)}; white-space:nowrap; }
    .co-tip .t { color:${ink(0.55)}; margin-bottom:4px; }
    .co-tip .r { display:flex; justify-content:space-between; gap:14px; }
    .co-tip .d { display:inline-block; width:8px; height:8px; border-radius:1px; margin-right:6px; }
    .co-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:stretch; }
    .co-card-fill { display:flex; flex-direction:column; }
    .co-fill-body { position:relative; flex:1 1 0; min-height:200px; margin-top:8px; }
    .co-fill-list { position:absolute; left:0; right:0; top:0; bottom:0; overflow:auto; }
    @media (max-width: 980px) {
      .co-grid2 { grid-template-columns:1fr; }
      .co-fill-body { min-height:420px; }
    }
    .co-table { width:100%; border-collapse:collapse; font-size:12.5px; font-variant-numeric:tabular-nums; }
    .co-table th, .co-table td { padding:5px 8px; text-align:right; border-bottom:1px solid ${ink(0.1)}; }
    .co-table th:first-child, .co-table td:first-child { text-align:left; }
    .co-table th { color:${ink(0.55)}; font-weight:500; }
    .co-table tbody tr:last-child td { border-bottom:0; }
    .co-badge { display:inline-block; padding:5px 14px; border-radius:7px; font-size:15px; font-weight:600; border:1px solid currentColor; }
    .co-up { color:${OX}; }
    .co-down { color:${INK}; }
    .co-flat { color:${BRASS}; }
    .co-chaos { color:${ink(0.62)}; }
    .co-note { font-size:12.5px; line-height:1.9; color:${ink(0.66)}; }
    .co-note b { color:${INK}; font-weight:600; }
    .co-err { padding:24px; font-size:13px; color:${OX}; }
    .co-empty { padding:28px; font-size:13px; color:${ink(0.55)}; }
    .co-foot { margin-top:10px; padding-top:10px; border-top:1px solid ${ink(0.12)}; font-size:11px; line-height:1.6; color:${ink(0.45)}; }
    `

    // ---------- 工具函数 ----------
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
    const nf = (v, d = 2) =>
      v == null || !Number.isFinite(v) ? '—' : Number(v).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d })
    const pct = (v, d = 1) => (v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(d)}%`)
    const signedColor = (v) => (v == null ? '' : v > 0 ? 'co-up' : v < 0 ? 'co-down' : '')
    const kindColorClass = (kind) => (kind === '趋势上行' ? 'co-up' : kind === '趋势下行' ? 'co-down' : kind === '震荡' ? 'co-flat' : 'co-chaos')
    function srcLabel(s) {
      if (!s || s === 'base_only') return '仅历史底图（实时源不可用）'
      return s
        .replace('sina-rt', '新浪实时')
        .replace('sina-kline', '新浪日K')
        .replace('sina', '新浪指数')
        .replace('tencent', '腾讯行情')
        .replace('eastmoney', '东方财富')
        .replace('+', ' + ')
    }
    function niceTicks(min, max, target) {
      const span = max - min
      if (!(span > 0)) return [min]
      const rough = span / (target ?? 4)
      const magnitude = 10 ** Math.floor(Math.log10(rough))
      const norm = rough / magnitude
      const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * magnitude
      const start = Math.ceil(min / step) * step
      const out = []
      for (let v = start; v <= max + step * 1e-6; v += step) out.push(Number(v.toFixed(10)))
      if (out.length >= 3) return out
      const finer = step / 2
      const fineStart = Math.ceil(min / finer) * finer
      const fine = []
      for (let v = fineStart; v <= max + finer * 1e-6; v += finer) fine.push(Number(v.toFixed(10)))
      return fine.length >= 2 ? fine : out.length >= 2 ? out : [min, max]
    }
    function buildPath(values, offset, xOf, yOf) {
      let d = ''
      let pen = false
      for (let i = 0; i < values.length; i += 1) {
        const v = values[i]
        if (v == null || !Number.isFinite(v)) {
          pen = false
          continue
        }
        d += `${pen ? 'L' : 'M'}${xOf(i + offset).toFixed(1)} ${yOf(v).toFixed(1)}`
        pen = true
      }
      return d
    }
    function buildBand(top, bottom, offset, xOf, yOf) {
      const up = []
      const down = []
      for (let i = 0; i < top.length; i += 1) {
        if (top[i] == null || bottom[i] == null) continue
        up.push([xOf(i + offset), yOf(top[i])])
        down.push([xOf(i + offset), yOf(bottom[i])])
      }
      if (up.length < 2) return ''
      let d = `M${up[0][0].toFixed(1)} ${up[0][1].toFixed(1)}`
      for (let i = 1; i < up.length; i += 1) d += `L${up[i][0].toFixed(1)} ${up[i][1].toFixed(1)}`
      for (let i = down.length - 1; i >= 0; i -= 1) d += `L${down[i][0].toFixed(1)} ${down[i][1].toFixed(1)}`
      return `${d}Z`
    }
    function textWidth(text) {
      let width = 0
      for (const ch of String(text)) width += ch.charCodeAt(0) > 255 ? 10.5 : 6.2
      return width
    }

    // ---------- 通用折线图 ----------
    const VW = 1000
    const MIN_SPAN = 20

    function LineChart(props) {
      const { count, dates, series, bands, domains, defaultStart, marker, formatLeft, formatRight, describe, hint, legend, id } = props
      const VH = props.height ?? 470
      const PL = 64
      const PR = 76
      const PT = 42
      const PB = 96
      const PW = VW - PL - PR
      const PH = VH - PT - PB
      const BASE = PT + PH
      const SX0 = PL
      const SX1 = VW - PR
      const SY = VH - 60
      const SH = 26
      const clipId = `co-clip-${id ?? 'chart'}`

      const [view, setView] = useState(() => ({ start: clamp(defaultStart, 0, count - 1), end: count - 1 }))
      const [hover, setHover] = useState(null)
      const [cursor, setCursor] = useState('crosshair')
      const svgRef = useRef(null)
      const boxRef = useRef(null)
      const dragRef = useRef(null)

      useEffect(() => {
        setView({ start: clamp(defaultStart, 0, count - 1), end: count - 1 })
      }, [count, defaultStart])

      const xOf = (i) => PL + ((i - view.start) / Math.max(1e-6, view.end - view.start)) * PW
      const idxOf = (px) => view.start + ((px - PL) / PW) * (view.end - view.start)
      const sIdx = (i) => SX0 + (i / Math.max(1, count - 1)) * (SX1 - SX0)
      const sVal = (px) => ((px - SX0) / (SX1 - SX0)) * (count - 1)

      // 纵轴随可见区间重算：domains 既可以是固定对象，也可以是 (start, end) => {left, right}
      const dom = useMemo(
        () => (typeof domains === 'function' ? domains(view.start, view.end) : domains),
        [domains, view.start, view.end],
      )
      const yLeft = (v) => PT + (1 - (v - dom.left.min) / (dom.left.max - dom.left.min || 1)) * PH
      const yRight = (v) => PT + (1 - (v - dom.right.min) / (dom.right.max - dom.right.min || 1)) * PH

      // 视窗变化时才重建路径
      const drawn = useMemo(() => {
        const x = (i) => PL + ((i - view.start) / Math.max(1e-6, view.end - view.start)) * PW
        const yl = (v) => PT + (1 - (v - dom.left.min) / (dom.left.max - dom.left.min || 1)) * PH
        const yr = (v) => PT + (1 - (v - dom.right.min) / (dom.right.max - dom.right.min || 1)) * PH
        return {
          bands: (bands ?? []).map((band) => ({
            ...band,
            d: buildBand(band.top, band.bottom, band.offset, x, (v) => (band.axis === 'right' ? yr(v) : yl(v))),
          })),
          series: (series ?? []).map((s) => ({
            ...s,
            d: buildPath(s.values, s.offset ?? 0, x, (v) => (s.axis === 'right' ? yr(v) : yl(v))),
          })),
          slider: (() => {
            const s0 = (series ?? [])[0]
            if (!s0) return ''
            let d = ''
            let pen = false
            let min = Infinity
            let max = -Infinity
            for (const v of s0.values) {
              if (v == null || !Number.isFinite(v)) continue
              if (v < min) min = v
              if (v > max) max = v
            }
            for (let i = 0; i < s0.values.length; i += 1) {
              const v = s0.values[i]
              if (v == null || !Number.isFinite(v)) {
                pen = false
                continue
              }
              const x = SX0 + (i / Math.max(1, count - 1)) * (SX1 - SX0)
              const y = SY + SH - 5 - ((v - min) / (max - min || 1)) * (SH - 10)
              d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
              pen = true
            }
            return d
          })(),
        }
      }, [view.start, view.end, series, bands, dom, count])

      const zoomView = (v, frac, factor) => {
        const span = v.end - v.start
        const nextSpan = clamp(span * factor, MIN_SPAN, count - 1)
        const anchor = v.start + frac * span
        let start = anchor - frac * nextSpan
        let end = start + nextSpan
        if (start < 0) {
          start = 0
          end = nextSpan
        }
        if (end > count - 1) {
          end = count - 1
          start = Math.max(0, end - nextSpan)
        }
        return { start, end }
      }

      // 缩放到默认窗口附近时吸附过去，保证「缩回原状」能精确复原
      const snapView = (v) => {
        const defStart = clamp(defaultStart, 0, count - 1)
        const defSpan = Math.max(1, count - 1 - defStart)
        const span = v.end - v.start
        if (v.end >= count - 1 - 0.5 && Math.abs(span - defSpan) <= defSpan * 0.12) {
          return { start: defStart, end: count - 1 }
        }
        return v
      }

      // 滚轮缩放只作用于绘图区（红框内）与底部滑块；
      // 左右纵轴、图例、日期标签、卡片留白都不拦截，交给页面滚动。缩到两端时同样放行。
      const viewRef = useRef(view)
      viewRef.current = view
      useEffect(() => {
        const svg = svgRef.current
        if (!svg) return undefined
        const onWheel = (event) => {
          const rect = svg.getBoundingClientRect()
          const px = ((event.clientX - rect.left) / rect.width) * VW
          const py = ((event.clientY - rect.top) / rect.height) * VH
          const inPlot = px >= PL && px <= PL + PW && py >= PT && py <= BASE
          const onSlider = px >= SX0 && px <= SX1 && py >= SY - 8 && py <= SY + SH + 8
          if (!inPlot && !onSlider) return
          const frac = clamp(onSlider ? (px - SX0) / (SX1 - SX0) : (px - PL) / PW, 0, 1)
          const factor = event.deltaY > 0 ? 1.15 : 1 / 1.15
          const span = viewRef.current.end - viewRef.current.start
          const atMax = span >= count - 1 - 0.5
          const atMin = span <= MIN_SPAN + 0.5
          if ((event.deltaY > 0 && atMax) || (event.deltaY < 0 && atMin)) return
          event.preventDefault()
          setView((v) => snapView(zoomView(v, frac, factor)))
        }
        svg.addEventListener('wheel', onWheel, { passive: false })
        return () => svg.removeEventListener('wheel', onWheel)
      }, [count])

      const locate = (event) => {
        const svg = svgRef.current
        const box = boxRef.current
        if (!svg || !box) return null
        const rect = svg.getBoundingClientRect()
        const boxRect = box.getBoundingClientRect()
        return {
          px: ((event.clientX - rect.left) / rect.width) * VW,
          py: ((event.clientY - rect.top) / rect.height) * VH,
          left: event.clientX - boxRect.left,
          top: event.clientY - boxRect.top,
        }
      }

      const sliderZone = (py) => py >= SY - 12 && py <= SY + SH + 12
      const sliderMode = (px) => {
        const l = sIdx(view.start)
        const r = sIdx(view.end)
        if (Math.abs(px - l) <= 11) return 'left'
        if (Math.abs(px - r) <= 11) return 'right'
        if (px > l && px < r) return 'body'
        return 'track'
      }

      const beginDrag = (mode, px, base, unit) => {
        dragRef.current = { mode, px, base, unit }
      }

      const onPointerDown = (event) => {
        const p = locate(event)
        if (!p) return
        const unitSpan = (view.end - view.start) / PW
        const unitSlider = (count - 1) / (SX1 - SX0)
        if (sliderZone(p.py)) {
          const mode = sliderMode(p.px)
          if (mode === 'track') {
            const span = view.end - view.start
            const idx = sVal(p.px)
            const start = clamp(idx - span / 2, 0, Math.max(0, count - 1 - span))
            const next = snapView({ start, end: start + span })
            setView(next)
            beginDrag('body', p.px, next, unitSlider)
          } else {
            beginDrag(mode, p.px, view, mode === 'body' ? unitSlider : unitSlider)
          }
        } else if (p.py >= PT && p.py <= BASE) {
          beginDrag('pan', p.px, view, unitSpan)
          setHover(null)
        } else {
          return
        }
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {}
      }

      const onPointerMove = (event) => {
        const p = locate(event)
        if (!p) return
        const drag = dragRef.current
        if (drag) {
          const delta = (p.px - drag.px) * drag.unit
          const span = drag.base.end - drag.base.start
          if (drag.mode === 'pan' || drag.mode === 'body') {
            const shift = drag.mode === 'pan' ? -delta : delta
            const start = clamp(drag.base.start + shift, 0, Math.max(0, count - 1 - span))
            setView({ start, end: start + span })
          } else if (drag.mode === 'left') {
            setView({ start: clamp(drag.base.start + delta, 0, drag.base.end - MIN_SPAN), end: drag.base.end })
          } else if (drag.mode === 'right') {
            setView({ start: drag.base.start, end: clamp(drag.base.end + delta, drag.base.start + MIN_SPAN, count - 1) })
          }
          return
        }
        if (sliderZone(p.py)) {
          const mode = sliderMode(p.px)
          setCursor(mode === 'left' || mode === 'right' ? 'ew-resize' : mode === 'body' ? 'grab' : 'pointer')
          if (hover) setHover(null)
          return
        }
        if (p.py >= PT && p.py <= BASE) {
          setCursor('crosshair')
          const index = Math.round(clamp(idxOf(p.px), Math.max(0, Math.floor(view.start)), Math.min(count - 1, Math.ceil(view.end))))
          setHover({ index, left: p.left, top: p.top })
          return
        }
        setCursor('default')
        if (hover) setHover(null)
      }

      const endDrag = () => {
        dragRef.current = null
        setCursor('crosshair')
        setView((v) => snapView(v))
      }

      const ticksLeft = niceTicks(dom.left.min, dom.left.max, 4)
      const ticksRight = niceTicks(dom.right.min, dom.right.max, 4)
      const digitsFor = (range) => {
        const step = Math.abs(range) / 4
        return step < 0.5 ? 2 : step < 5 ? 1 : 0
      }
      const fmtLeftAxis = (v) => nf(v, digitsFor(dom.left.max - dom.left.min))
      const fmtRightAxis = (v) => nf(v, digitsFor(dom.right.max - dom.right.min))
      const xTicks = Array.from({ length: 5 }, (_, i) => {
        const idx = Math.round(view.start + ((view.end - view.start) * i) / 4)
        return { idx, x: xOf(idx) }
      })

      const tooltip = hover && describe ? describe(hover.index) : null
      let legendX = PL

      return h(
        'div',
        { className: 'co-chart', ref: boxRef },
        h(
          'svg',
          {
            ref: svgRef,
            viewBox: `0 0 ${VW} ${VH}`,
            width: '100%',
            preserveAspectRatio: 'xMidYMid meet',
            style: { display: 'block', width: '100%', height: 'auto', touchAction: 'none', cursor, userSelect: 'none' },
            onPointerDown,
            onPointerMove,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
            onPointerLeave: () => {
              endDrag()
              setHover(null)
            },
            onDoubleClick: () => setView({ start: clamp(defaultStart, 0, count - 1), end: count - 1 }),
          },
          h('defs', null, h('clipPath', { id: clipId }, h('rect', { x: PL, y: PT, width: PW, height: PH }))),
          // 透明命中层：让坐标轴、图例、空白处也能接收滚轮与拖动
          h('rect', { x: 0, y: 0, width: VW, height: VH, fill: '#000', fillOpacity: 0, style: { pointerEvents: 'all' } }),
          // 图例（纸面内，墨色）
          (legend ?? []).map((item) => {
            const x = legendX
            legendX += 20 + textWidth(item.label) + 18
            return h(
              'g',
              { key: item.label },
              h('line', { x1: x, y1: 20, x2: x + 16, y2: 20, stroke: item.color, strokeWidth: 2.4, strokeDasharray: item.dash }),
              h('text', { x: x + 22, y: 24, fontSize: 11.5, fill: ink(0.78) }, item.label),
            )
          }),
          // 网格与左右刻度
          ticksLeft.map((v, i) =>
            h(
              'g',
              { key: `yl${i}` },
              h('line', {
                x1: PL,
                x2: PL + PW,
                y1: yLeft(v),
                y2: yLeft(v),
                stroke: ink(0.12),
                strokeWidth: 1,
                strokeDasharray: i === 0 ? undefined : '2 4',
              }),
              h('text', { x: PL - 8, y: yLeft(v) + 4, textAnchor: 'end', fontSize: 10.5, fill: ink(0.55) }, fmtLeftAxis(v)),
            ),
          ),
          ticksRight.map((v, i) =>
            h('text', { key: `yr${i}`, x: PL + PW + 8, y: yRight(v) + 4, textAnchor: 'start', fontSize: 10.5, fill: ink(0.55) }, fmtRightAxis(v)),
          ),
          xTicks.map((t, i) =>
            h(
              'text',
              {
                key: `xt${i}`,
                x: t.x,
                y: BASE + 18,
                textAnchor: i === 0 ? 'start' : i === 4 ? 'end' : 'middle',
                fontSize: 10.5,
                fill: ink(0.55),
              },
              dates[t.idx] ?? '',
            ),
          ),
          // 预测起点
          marker != null && marker >= view.start && marker <= view.end
            ? h(
                'g',
                null,
                h('rect', { x: xOf(marker), y: PT, width: Math.max(0, PL + PW - xOf(marker)), height: PH, fill: ox(0.04) }),
                h('line', { x1: xOf(marker), x2: xOf(marker), y1: PT, y2: BASE, stroke: ink(0.45), strokeWidth: 1, strokeDasharray: '4 4' }),
                h('text', { x: xOf(marker) + 6, y: PT + 13, fontSize: 10, fill: ink(0.5) }, '预测起点'),
              )
            : null,
          // 扇形带与曲线
          h(
            'g',
            { clipPath: `url(#${clipId})` },
            drawn.bands.map((band, i) => h('path', { key: `b${i}`, d: band.d, fill: band.color, fillOpacity: band.opacity ?? 0.12 })),
            drawn.series.map((s, i) =>
              h('path', {
                key: `s${i}`,
                d: s.d,
                fill: 'none',
                stroke: s.color,
                strokeWidth: s.width ?? 1.7,
                strokeDasharray: s.dash,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }),
            ),
          ),
          // 悬停十字线
          hover ? h('line', { x1: xOf(hover.index), x2: xOf(hover.index), y1: PT, y2: BASE, stroke: ink(0.35), strokeWidth: 1 }) : null,
          // 底部滑块：缩略走势 + 选区
          h(
            'g',
            null,
            h('rect', { x: SX0, y: SY, width: SX1 - SX0, height: SH, rx: 4, fill: ink(0.06) }),
            h('path', { d: drawn.slider, fill: 'none', stroke: ink(0.38), strokeWidth: 1 }),
            h('rect', {
              x: sIdx(view.start),
              y: SY - 2,
              width: Math.max(3, sIdx(view.end) - sIdx(view.start)),
              height: SH + 4,
              rx: 3,
              fill: ox(0.1),
              stroke: OX,
              strokeWidth: 1,
            }),
            [view.start, view.end].map((v, i) =>
              h('rect', {
                key: `h${i}`,
                x: sIdx(v) - 4,
                y: SY - 4,
                width: 8,
                height: SH + 8,
                rx: 2,
                fill: OX,
              }),
            ),
          ),
        ),
        tooltip
          ? h(
              'div',
              {
                className: 'co-tip',
                style: {
                  left: Math.min(Math.max(8, hover.left + 14), Math.max(8, (boxRef.current?.clientWidth ?? 600) - 200)),
                  top: Math.max(8, hover.top - 12),
                },
              },
              h('div', { className: 't' }, tooltip.title),
              tooltip.rows.map((row, i) =>
                h(
                  'div',
                  { className: 'r', key: i },
                  h('span', null, row.color ? h('i', { className: 'd', style: { background: row.color } }) : null, row.label),
                  h('span', null, row.value),
                ),
              ),
            )
          : null,
        hint ? h('div', { className: 'co-hint' }, hint) : null,
      )
    }

    // ---------- 滞后分布图 ----------
    function LagChart({ lag }) {
      const [hover, setHover] = useState(null)
      const [width, setWidth] = useState(960)
      const boxRef = useRef(null)
      useEffect(() => {
        const el = boxRef.current
        if (!el || typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver((entries) => {
          const next = entries[0]?.contentRect?.width
          if (next) setWidth(next)
        })
        observer.observe(el)
        return () => observer.disconnect()
      }, [])
      const grid = lag.grid
      const weights = grid.map((L) => (lag.w[String(L)] ?? 0) * 100)
      const rhos = grid.map((L) => lag.rho[String(L)] ?? 0)
      const maxW = Math.max(...weights.filter((v) => Number.isFinite(v)), 1)
      const minR = Math.min(...rhos.filter((v) => Number.isFinite(v)), 0)
      const maxR = Math.max(...rhos.filter((v) => Number.isFinite(v)), 0.01)
      const W = Math.max(320, Math.round(width))
      const H = 196
      const pl = 46
      const pr = 46
      const pt = 16
      const pb = 30
      const plotH = H - pt - pb
      const baseline = pt + plotH
      const bandW = (W - pl - pr) / grid.length
      const yW = (v) => pt + (1 - v / maxW) * plotH
      const yR = (v) => pt + (1 - (v - minR) / (maxR - minR || 1)) * plotH
      const leftTicks = [maxW, maxW / 2, 0]
      const rightTicks = [maxR, 0, minR]
      const focused = (L) => Math.abs(L - lag.eff) < 4
      return h(
        'div',
        { className: 'co-chart', ref: boxRef },
        h(
          'svg',
          { viewBox: `0 0 ${W} ${H}`, width: '100%', preserveAspectRatio: 'xMidYMid meet', style: { display: 'block', width: '100%', height: H } },
          leftTicks.map((v, i) =>
            h('line', {
              key: `g${i}`,
              x1: pl,
              x2: W - pr,
              y1: yW(v),
              y2: yW(v),
              stroke: ink(0.12),
              strokeWidth: 1,
              strokeDasharray: i === leftTicks.length - 1 ? undefined : '2 4',
            }),
          ),
          leftTicks.map((v, i) =>
            h(
              'text',
              { key: `lt${i}`, x: pl - 8, y: yW(v) + 4, textAnchor: 'end', fontSize: 10, fill: ink(0.55) },
              `${v.toFixed(v >= 10 ? 0 : 1)}%`,
            ),
          ),
          rightTicks.map((v, i) =>
            h('text', { key: `rt${i}`, x: W - pr + 8, y: yR(v) + 4, textAnchor: 'start', fontSize: 10, fill: ink(0.55) }, v.toFixed(2)),
          ),
          grid.map((L, i) =>
            h(
              'g',
              { key: L, onPointerEnter: () => setHover(i), onPointerLeave: () => setHover(null) },
              h('rect', { x: pl + i * bandW, y: pt, width: bandW, height: plotH, fill: 'transparent' }),
              h('rect', {
                x: pl + i * bandW + bandW * 0.26,
                y: yW(weights[i]),
                width: bandW * 0.48,
                height: Math.max(1, baseline - yW(weights[i])),
                rx: 1.5,
                fill: C.bar,
                opacity: hover != null && hover !== i ? 0.25 : focused(L) ? 0.92 : 0.5,
              }),
              h(
                'text',
                { x: pl + i * bandW + bandW / 2, y: H - 12, textAnchor: 'middle', fontSize: 9.5, fill: ink(0.55) },
                String(L),
              ),
            ),
          ),
          h('path', {
            d: grid.map((_, i) => `${i === 0 ? 'M' : 'L'}${(pl + i * bandW + bandW / 2).toFixed(1)} ${yR(rhos[i]).toFixed(1)}`).join(''),
            fill: 'none',
            stroke: C.rho,
            strokeWidth: 1.5,
          }),
          grid.map((_, i) =>
            h('circle', { key: `c${i}`, cx: pl + i * bandW + bandW / 2, cy: yR(rhos[i]), r: hover === i ? 3 : 1.6, fill: C.rho }),
          ),
          h('line', { x1: pl, x2: W - pr, y1: baseline, y2: baseline, stroke: ink(0.18), strokeWidth: 1 }),
        ),
        hover != null
          ? h(
              'div',
              { className: 'co-tip', style: { left: '12px', top: '8px' } },
              h('div', { className: 't' }, `滞后 ${grid[hover]} 个交易日`),
              h('div', { className: 'r' }, h('span', null, '权重'), h('span', null, `${weights[hover].toFixed(1)}%`)),
              h('div', { className: 'r' }, h('span', null, '相关性 ρ'), h('span', null, rhos[hover].toFixed(3))),
            )
          : null,
      )
    }

    // ---------- 数据 ----------
    function usePayload() {
      const [state, setState] = useState({ loading: true, error: null, data: null })
      const load = async (force) => {
        setState((prev) => ({ ...prev, loading: true }))
        try {
          const res = await fetch(`/copper-oil/api/data${force ? '?refresh=1' : ''}`, { cache: 'no-store' })
          const body = await res.json()
          if (!res.ok || body?.error) throw new Error(body?.error || `HTTP ${res.status}`)
          setState({ loading: false, error: null, data: body })
        } catch (error) {
          setState((prev) => ({ loading: false, error: String(error?.message ?? error), data: prev.data }))
        }
      }
      useEffect(() => {
        load(false)
        const timer = setInterval(() => {
          if (typeof document !== 'undefined' && document.hidden) return
          load(true)
        }, 5 * 60 * 1000)
        return () => clearInterval(timer)
      }, [])
      return [state, () => load(true)]
    }

    // ---------- 主面板 ----------
    function Panel() {
      const [state, refresh] = usePayload()
      const [alignAxis, setAlignAxis] = useState(true)
      const data = state.data

      const view = useMemo(() => {
        if (!data) return null
        const n = data.n
        const fc = data.forecast
        const count = data.chart_dates.length
        const start = Math.max(0, n - 250)
        const lastSh = data.close_sh[n - 1]

        // 纵轴：默认窗口的「高低点对齐」刻度只算一次；
        // 可见区间落在默认窗口内部（或正好等于它）时沿用它，拉到更宽或平移到更早区间时才各自自适应。
        const rangesFor = (s, e) => {
          const lo = Math.max(0, Math.floor(s))
          const hi = Math.min(count - 1, Math.ceil(e))
          const histHi = Math.min(hi, n - 1)
          const sseVals = []
          for (let i = lo; i <= histHi; i += 1) if (data.close_sh_chart[i] != null) sseVals.push(data.close_sh_chart[i])
          let bandLow = Infinity
          for (const k of [5, 10, 20]) {
            const ma = fc[`ma${k}`]
            const p10 = fc[`band${k}`].p10
            // 轴的高点/低点只看历史与三条预测线；扇形带下沿单独记录，用来算底部预留
            for (let j = Math.max(0, lo - n); j < ma.length && n + j <= hi; j += 1) {
              sseVals.push(ma[j])
              if (p10[j] < bandLow) bandLow = p10[j]
            }
          }
          const ratioVals = []
          for (let i = lo; i <= hi; i += 1) if (data.ratio_chart[i] != null) ratioVals.push(data.ratio_chart[i])
          let sseFirst = null
          for (let i = lo; i <= histHi; i += 1) if (data.close_sh_chart[i] != null) { sseFirst = data.close_sh_chart[i]; break }
          let rFirst = null
          for (let i = lo; i <= hi; i += 1) if (data.ratio_chart[i] != null) { rFirst = data.ratio_chart[i]; break }
          return { sseVals, ratioVals, sseFirst, rFirst, bandLow }
        }

        const adaptiveOf = ({ sseVals, ratioVals }) => {
          if (!sseVals.length || !ratioVals.length) return { left: { min: 0, max: 100 }, right: { min: 0, max: 100 } }
          const sseMin = Math.min(...sseVals)
          const sseMax = Math.max(...sseVals)
          const rMin = Math.min(...ratioVals)
          const rMax = Math.max(...ratioVals)
          const spanR = Math.max(rMax - rMin, 1e-6)
          const spanS = Math.max(sseMax - sseMin, 1)
          let left = { min: rMin - spanR * 0.06, max: rMax + spanR * 0.06 }
          let right = { min: sseMin - spanS * 0.04, max: sseMax + spanS * 0.04 }
          if (!(left.max > left.min)) left = { min: left.min - 5, max: left.min + 5 }
          if (!(right.max > right.min)) right = { min: right.min - 50, max: right.min + 50 }
          return { left, right }
        }

        // 高低点对齐：两条曲线各自贴合自身数据（上证＝近一年+预测段，铜油比＝滞后对齐后的同一窗口），
        // 用同一比例留白，于是高点齐顶、低点齐底。
        const alignedOf = (ranges) => {
          const { sseVals, ratioVals, bandLow } = ranges
          if (!sseVals.length || !ratioVals.length) return adaptiveOf(ranges)
          let sseMin = Math.min(...sseVals)
          let sseMax = Math.max(...sseVals)
          if (!(sseMax > sseMin)) {
            sseMin -= 1
            sseMax += 1
          }
          let rMin = Math.min(...ratioVals)
          let rMax = Math.max(...ratioVals)
          if (!(rMax > rMin)) {
            rMin -= 1
            rMax += 1
          }
          const sSpan = sseMax - sseMin
          const rSpan = rMax - rMin
          // 底部预留 = 三条预测线低点 → 扇形带下沿的距离；换算成占轴跨度的比例，铜油比按同一比例预留
          const gap = Number.isFinite(bandLow) ? Math.max(0, sseMin - bandLow) : 0
          const reserve = clamp(gap / sSpan, 0, 0.35)
          return {
            left: { min: rMin - rSpan * reserve, max: rMax },
            right: { min: sseMin - sSpan * reserve, max: sseMax },
          }
        }

        const defaultAligned = alignedOf(rangesFor(start, count - 1))

        const domainFor = (s, e) => {
          const ranges = rangesFor(s, e)
          const insideDefault = s >= start - 0.5 && e <= count - 1 + 0.5
          if (alignAxis && insideDefault) return defaultAligned
          return adaptiveOf(ranges)
        }

        const anchor = (arr) => [lastSh, ...arr]
        const bands = [
          { top: anchor(fc.band20.p90), bottom: anchor(fc.band20.p10), offset: n - 1, axis: 'right', color: C.band20, opacity: 0.1 },
          { top: anchor(fc.band10.p90), bottom: anchor(fc.band10.p10), offset: n - 1, axis: 'right', color: C.band10, opacity: 0.14 },
          { top: anchor(fc.band5.p90), bottom: anchor(fc.band5.p10), offset: n - 1, axis: 'right', color: C.band5, opacity: 0.1 },
        ]
        const series = [
          { values: data.close_sh_chart, offset: 0, axis: 'right', color: C.sh, width: 2 },
          { values: data.ratio_chart, offset: 0, axis: 'left', color: C.ratio, width: 1.8 },
          { values: anchor(fc.ma20), offset: n - 1, axis: 'right', color: C.m20, width: 1.5 },
          { values: anchor(fc.ma10), offset: n - 1, axis: 'right', color: C.m10, width: 1.5, dash: '5 3' },
          { values: anchor(fc.ma5), offset: n - 1, axis: 'right', color: C.m5, width: 1.6 },
        ]

        const describe = (index) => {
          const rows = []
          const sh = data.close_sh_chart[index]
          const ratio = data.ratio_chart[index]
          if (sh != null) rows.push({ label: '上证指数', value: nf(sh), color: C.sh })
          if (ratio != null) rows.push({ label: '铜油比', value: nf(ratio), color: C.ratio })
          const j = index - n
          if (j >= 0) {
            for (const k of [5, 10, 20]) {
              const ma = fc[`ma${k}`][j]
              if (ma != null) rows.push({ label: `${k} 日均线预测`, value: nf(ma), color: k === 5 ? C.m5 : k === 10 ? C.m10 : C.m20 })
            }
            for (const k of [5, 10, 20]) {
              const band = fc[`band${k}`]
              if (band && band.p10[j] != null) {
                rows.push({
                  label: `${k} 均区间 P10–P90`,
                  value: `${nf(band.p10[j], 0)} ~ ${nf(band.p90[j], 0)}`,
                  color: k === 5 ? C.band5 : k === 10 ? C.band10 : C.band20,
                })
              }
            }
          }
          return { title: data.chart_dates[index] ?? '', rows }
        }

        return { n, fc, count, start, domainFor, bands, series, describe }
      }, [data, alignAxis])

      const priceView = useMemo(() => {
        if (!data) return null
        const cu = data.close_cu
        const sc = data.close_sc
        const pad = (arr, lo, hi) => {
          let min = Infinity
          let max = -Infinity
          for (let i = lo; i <= hi; i += 1) {
            const v = arr[i]
            if (v == null || !Number.isFinite(v)) continue
            if (v < min) min = v
            if (v > max) max = v
          }
          if (!Number.isFinite(min)) return { min: 0, max: 1 }
          const d = (max - min) * 0.05 || 1
          return { min: min - d, max: max + d }
        }
        const domainFor = (s, e) => {
          const lo = Math.max(0, Math.floor(s))
          const hi = Math.min(data.dates.length - 1, Math.ceil(e))
          return { left: pad(cu, lo, hi), right: pad(sc, lo, hi) }
        }
        return {
          count: data.dates.length,
          dates: data.dates,
          domainFor,
          series: [
            { values: cu, offset: 0, axis: 'left', color: C.cu, width: 1.5 },
            { values: sc, offset: 0, axis: 'right', color: C.sc, width: 1.5 },
          ],
          describe: (index) => ({
            title: data.dates[index] ?? '',
            rows: [
              { label: '沪铜连续（元/吨）', value: nf(cu[index], 0), color: C.cu },
              { label: '原油连续（元/桶）', value: nf(sc[index], 2), color: C.sc },
            ],
          }),
          formatLeft: (x) => nf(x, 0),
          formatRight: (x) => nf(x, 1),
        }
      }, [data])

      if (!data) {
        return h(
          'div',
          { className: 'co-root' },
          h('style', null, CSS),
          state.error
            ? h('div', { className: 'co-err' }, `加载失败：${state.error}`)
            : h('div', { className: 'co-empty' }, '正在加载铜油比数据…'),
        )
      }

      const meta = data.meta
      const fc = data.forecast
      const lag = data.lag
      const mm = data.metrics
      const v = view
      const trend = kindOf(data.trend)
      // 与上一交易日比较：涨 → 酒红，跌 → 墨青
      const deltaClass = (arr) => {
        if (!Array.isArray(arr) || arr.length < 2) return ''
        const last = arr[arr.length - 1]
        const before = arr[arr.length - 2]
        if (!Number.isFinite(last) || !Number.isFinite(before)) return ''
        if (last > before) return 'co-up'
        if (last < before) return 'co-down'
        return ''
      }

      const trendText = () => {
        const parts = [5, 10, 20].map((k) => {
          const m = mm[String(k)]
          return h(
            'span',
            { key: k },
            h('span', { className: kindColorClass(m.kind) }, `${k}均 ${m.kind}`),
            `（β ${nf(m.beta, 2)}，净 ${pct(m.net)}，方向一致度 ${Math.round(m.same * 100)}%）`,
          )
        })
        return h(
          'div',
          { className: 'co-hint', style: { marginTop: 10, fontSize: 12 } },
          h('div', null, `区间 ${meta.end} → ${meta.forecast_end}（${meta.future_td} 个交易日，按工作日估算）。`),
          h(
            'div',
            null,
            `滞后分布：加权平均 ${nf(meta.lag.eff, 1)} 日（P10–P90 ${lag.p10}–${lag.p90} 日，标准差 ${nf(lag.sd, 1)}），相关性最高 ${lag.best} 日（ρ=${nf(lag.rho[String(lag.best)], 2)}）。`,
          ),
          h(
            'div',
            null,
            '三条均线预测终点：',
            h('b', { style: { color: C.m5 } }, nf(mm['5'].end, 0)),
            ' / ',
            h('b', { style: { color: C.m10 } }, nf(mm['10'].end, 0)),
            ' / ',
            h('b', { style: { color: C.m20 } }, nf(mm['20'].end, 0)),
            `，较最新（${nf(meta.current_sh, 0)}）分别 ${pct(mm['5'].net)} / ${pct(mm['10'].net)} / ${pct(mm['20'].net)}。`,
          ),
          h('div', { style: { marginTop: 4 } }, parts),
        )
      }

      return h(
        'div',
        { className: 'co-root' },
        h('style', null, CSS),
        h(
          'div',
          { className: 'co-wrap' },
          h(
            'div',
            { className: 'co-head' },
            h(
              'div',
              null,
              h(
                'div',
                { className: 'co-title' },
                '铜油比 · 上证指数看板',
                h(
                  'a',
                  {
                    className: 'co-ref',
                    href: 'https://mp.weixin.qq.com/s/U7r0g-JHUolmj9gCBjZr5g',
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    title: '公众号原文：铜油比 & 股指',
                  },
                  '（公众号原文：铜油比&股指）',
                ),
              ),
              h(
                'div',
                { className: 'co-sub' },
                `铜油比 = 沪铜连续（CU0）÷ 原油连续（SC0）｜ 60~130 个交易日的滞后按滚动相关性加权，当前有效滞后 ${meta.lead_td} 日 ｜ 滞后几天就预测几天，未来 ${meta.future_td} 个交易日 ｜ 更新于 ${meta.updated} ｜ 数据源 ${srcLabel(meta.source)}`,
              ),
            ),
            h('button', { className: 'co-btn', disabled: state.loading, onClick: refresh }, state.loading ? '刷新中…' : '立即刷新'),
          ),

          h(
            'div',
            { className: 'co-kpis' },
            h('div', { className: 'co-kpi' }, h('div', { className: `v ${deltaClass(data.R)}` }, nf(meta.current_R)), h('div', { className: 'l' }, '当前铜油比')),
            h('div', { className: 'co-kpi' }, h('div', { className: `v ${deltaClass(data.close_sh)}` }, nf(meta.current_sh)), h('div', { className: 'l' }, '上证指数')),
            h('div', { className: 'co-kpi' }, h('div', { className: `v ${deltaClass(data.close_cu)}` }, nf(meta.current_cu, 0)), h('div', { className: 'l' }, '沪铜连续（元/吨）')),
            h('div', { className: 'co-kpi' }, h('div', { className: `v ${deltaClass(data.close_sc)}` }, nf(meta.current_sc, 1)), h('div', { className: 'l' }, '原油连续（元/桶）')),
            h('div', { className: 'co-kpi' }, h('div', { className: 'v' }, meta.end), h('div', { className: 'l' }, '数据末日')),
          ),

          h(
            'div',
            { className: 'co-card' },
            h(
              'div',
              { className: 'co-card-h' },
              h('div', { className: 'co-card-t' }, '上证指数 vs 铜油比（滞后按分布加权）＋ 未来预测'),
              h('div', { className: 'co-card-s' }, `滞后 ${meta.lead_td} 个交易日 · 预测 ${meta.future_td} 个交易日`),
              h(
                'button',
                {
                  className: `co-toggle${alignAxis ? ' on' : ''}`,
                  onClick: () => setAlignAxis(!alignAxis),
                  title: '开启时，默认视窗下两条曲线的高点齐顶、低点齐底（上证取近一年+预测段，铜油比取滞后对齐的同一窗口）',
                },
                h('span', { className: 'co-toggle-box' }, alignAxis ? '✓' : ''),
                '高低点对齐',
              ),
            ),
            h(LineChart, {
              id: 'main',
              count: v.count,
              dates: data.chart_dates,
              series: v.series,
              bands: v.bands,
              domains: v.domainFor,
              defaultStart: v.start,
              marker: data.n - 1,
              formatLeft: (x) => nf(x, 0),
              formatRight: (x) => nf(x, 0),
              describe: v.describe,
              legend: [
                { label: '上证指数', color: C.sh },
                { label: `铜油比（滞后 ${meta.lead_td} 日）`, color: C.ratio },
                { label: '5 日均线预测', color: C.m5 },
                { label: '10 日均线预测', color: C.m10, dash: '5 3' },
                { label: '20 日均线预测', color: C.m20 },
              ],
              hint:
                '在绘图区内滚轮缩放、拖动平移（左右纵轴与图例区域不拦截滚轮，交给页面滚动）；底部滑块可拖窗口、拖两端缩放、点击轨道跳转、双击复位。默认窗口及更窄的区间沿用默认的双轴刻度（高点齐顶、低点齐底），拉到比默认更宽或平移到更早区间时，两轴各自贴合可见数据。',
            }),
          ),

          h(
            'div',
            { className: 'co-card' },
            h('div', { className: 'co-card-h' }, h('div', { className: 'co-card-t' }, '沪铜连续 / 原油连续（元/吨 · 元/桶）')),
            h(LineChart, {
              id: 'price',
              height: 360,
              count: priceView.count,
              dates: priceView.dates,
              series: priceView.series,
              domains: priceView.domainFor,
              defaultStart: 0,
              marker: null,
              formatLeft: priceView.formatLeft,
              formatRight: priceView.formatRight,
              describe: priceView.describe,
              legend: [
                { label: '沪铜连续', color: C.cu },
                { label: '原油连续', color: C.sc },
              ],
              hint: '滚轮缩放、拖动平移，底部滑块同主图；左轴沪铜、右轴原油。',
            }),
          ),

          h(
            'div',
            { className: 'co-grid2' },
            h(
              'div',
              { className: 'co-card', style: { marginBottom: 0 } },
              h('div', { className: 'co-card-h' }, h('div', { className: 'co-card-t' }, `未来 ${meta.future_td} 个交易日走势预估`)),
              h(
                'div',
                null,
                h('span', { className: 'co-badge', style: { color: trend.fg, background: trend.bg, borderColor: trend.fg } }, data.trend),
              ),
              trendText(),
              h(
                'table',
                { className: 'co-table', style: { marginTop: 10 } },
                h('thead', null, h('tr', null, ['均线', '终点', '净变动', '方向一致度', '弹性 β', '类型'].map((label) => h('th', { key: label }, label)))),
                h(
                  'tbody',
                  null,
                  [5, 10, 20].map((k) => {
                    const m = mm[String(k)]
                    const kind = kindOf(m.kind)
                    return h(
                      'tr',
                      { key: k },
                      h('td', null, `${k} 日`),
                      h('td', null, nf(m.end, 0)),
                      h('td', { className: signedColor(m.net) }, pct(m.net)),
                      h('td', null, `${Math.round(m.same * 100)}%`),
                      h('td', null, nf(m.beta, 2)),
                      h('td', { style: { color: kind.fg } }, m.kind),
                    )
                  }),
                ),
              ),
              h('div', { className: 'co-card-s', style: { marginTop: 12 } }, '滞后分布（柱＝权重，线＝相关性 ρ）'),
              h(LagChart, { lag }),
            ),
            h(
              'div',
              { className: 'co-card co-card-fill', style: { marginBottom: 0 } },
              h('div', { className: 'co-card-h' }, h('div', { className: 'co-card-t' }, `未来 ${meta.future_td} 个交易日预测值列表`)),
              h('div', { className: 'co-card-s' }, `${data.trend} ｜ 区间 ${fc.dates[0]} → ${fc.dates[fc.dates.length - 1]}，共 ${fc.dates.length} 个交易日`),
              h(
                'div',
                { className: 'co-fill-body' },
                h(
                  'div',
                  { className: 'co-fill-list' },
                  h(
                    'table',
                    { className: 'co-table' },
                    h('thead', null, h('tr', null, h('th', null, '日期'), h('th', null, '5 日均线预测'), h('th', null, '10 日均线预测'), h('th', null, '20 日均线预测'))),
                    h(
                      'tbody',
                      null,
                      fc.dates.map((date, i) =>
                        h(
                          'tr',
                          { key: date },
                          h('td', null, date),
                          h('td', { style: { color: C.m5 } }, nf(fc.ma5[i], 0)),
                          h('td', { style: { color: C.m10 } }, nf(fc.ma10[i], 0)),
                          h('td', { style: { color: C.m20 } }, nf(fc.ma20[i], 0)),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),

          h(
            'div',
            { className: 'co-card co-note', style: { marginTop: 14 } },
            h('b', null, '计算口径：'),
            '铜油比 = 沪铜连续收盘 ÷ 原油连续收盘。滞后不固定：在 60~130 个交易日里给每个滞后 L 各算一条预测路径，权重 ',
            h('b', null, 'wL ∝ exp(ρL/0.15)'),
            '，ρL 是最近 250 个交易日「错位 L 日后的 20 日变化」相关系数；再按权重取中位数与 P10/P90 扇形区间。每条路径：',
            h('b', null, '预测L(t+j) = 上证(t) × ( 均线(t-L+j) ÷ 均线(t-L-1) ) ^ βL'),
            '，βL 为该滞后下的历史对数弹性。预测长度 ＝ 有效滞后天数：滞后 88 个交易日就预测未来 88 个交易日；第 j 天只用还能覆盖到这一天的滞后（L > j），窗口最后 10% 权重线性衰减。主图的铜油比按加权平均滞后对齐。',
            h(
              'div',
              { style: { marginTop: 8 } },
              h('b', null, '数据：'),
              '新浪财经（沪铜连续 CU0、原油连续 SC0）与东方财富（上证指数 000001），原油连续 2018-03-26 上市，样本自该日起。',
            ),
          ),

          h('div', { className: 'co-foot' }, '以上内容仅供参考，不构成任何投资建议。预测仅为按指定公式的统计外推，历史规律可能失效。投资有风险，决策需谨慎。'),
        ),
      )
    }

    // ---------- 图标 ----------
    function SidebarIcon(props) {
      const size = props?.size ?? 20
      const color = props?.active ? OX : ink(0.55)
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M3 19h18', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.6 }),
        h('path', {
          d: 'M3 15.5l4.5-4 3.5 2 4.5-6 2.5 2 3-3.5',
          stroke: color,
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        h('circle', { cx: 20, cy: 6, r: 2, fill: color }),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() =>
          ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register({ name: 'sidebar.panellist', id: 'copper-oil', order: 30, label: () => '铜油比' }, SidebarIcon),
          ),
        )
        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'copper-oil' }, Panel)))
      },
    }
  },
})
