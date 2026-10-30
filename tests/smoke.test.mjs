import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('manifest 声明了 bundle patch 与 client 半边', async () => {
  const pkg = JSON.parse(await read('package.json'))
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.ok(pkg.exports['./client'], '应导出 ./client')
  const patch = await read('cordis.patch.yml')
  assert.match(patch, /- insert:/)
  assert.ok(patch.includes(pkg.name), 'patch 里应插入包名')
})

test('locale 提供标题与描述', async () => {
  for (const lang of ['zh', 'en']) {
    const dict = JSON.parse(await read(`locale/${lang}.json`))
    assert.ok(dict.meta?.title, `${lang} 缺 meta.title`)
    assert.ok(dict.meta?.description, `${lang} 缺 meta.description`)
  }
})

test('图标是有效的 svg', async () => {
  const svg = await read('icon.svg')
  assert.match(svg, /^<svg[\s>]/)
})

test('Host 半边注册路由与工具', async () => {
  const mod = await import(new URL('index.js', root).href)
  assert.equal(typeof mod.apply, 'function')
  assert.deepEqual(mod.inject, ['webServer', 'tools'])

  const routes = []
  const tools = []
  mod.apply({
    effect: (fn) => fn(),
    webServer: {
      register(route) {
        routes.push(route)
        return () => {}
      },
    },
    tools: {
      register(tool) {
        tools.push(tool)
        return () => {}
      },
    },
  })

  assert.equal(routes.length, 1)
  assert.equal(routes[0].kind, 'prefix')
  assert.equal(routes[0].path, '/copper-oil/api')
  assert.equal(tools.length, 1)
  assert.equal(tools[0].name, 'copper_oil_snapshot')
  assert.equal(typeof tools[0].execute, 'function')
})

test('Client 半边注册侧边栏入口与主面板', async () => {
  globalThis.window = {
    __ModuleLoader__: {
      load(definition) {
        globalThis.__clientDefinition = definition
      },
    },
  }
  await import(new URL('client.js', root).href)

  const definition = globalThis.__clientDefinition
  assert.equal(typeof definition.factory, 'function')

  const React = {
    createElement: () => null,
    useState: (value) => [value, () => {}],
    useEffect: () => {},
    useRef: () => ({ current: null }),
    useMemo: (factory) => factory(),
  }
  const mod = definition.factory((name) => {
    assert.equal(name, 'react')
    return React
  })

  const registrations = []
  mod.apply({
    effect: (fn) => fn(),
    slots: {
      inject: (_key, callback) => callback(),
      register(options) {
        registrations.push(options)
        return () => {}
      },
    },
  })

  assert.equal(registrations.length, 2)
  assert.deepEqual(
    registrations.map((r) => r.name).sort(),
    ['main', 'sidebar.panellist'],
  )
})

test('配置默认值与覆盖', async () => {
  const mod = await import(new URL('index.js', root).href)
  assert.deepEqual(
    Object.keys(mod.DEFAULT_SETTINGS).sort(),
    ['cacheMinutes', 'enableTool', 'lagMax', 'lagMin', 'lagStep', 'lagTau', 'lagWindow'],
  )
  assert.equal(mod.DEFAULT_SETTINGS.enableTool, true)

  const tools = []
  mod.apply(
    {
      effect: (fn) => fn(),
      webServer: { register: () => () => {} },
      tools: {
        register(tool) {
          tools.push(tool)
          return () => {}
        },
      },
    },
    { enableTool: false, cacheMinutes: 9 },
  )
  assert.equal(tools.length, 0, 'enableTool=false 时不应注册工具')
})
