import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { isProtected, isEmployeePage, isPublicPage, PROTECTED_PATHS, PUBLIC_PATHS } from '../../src/lib/server/routes'

// Every page file becomes a URL. `index` is its folder, `[id]` is any value.
function pageRoutes(dir: string, base = ''): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (base === '' && name === 'api') continue
      out.push(...pageRoutes(full, `${base}/${name}`))
    } else if (/\.(tsx|ts)$/.test(name) && !name.startsWith('_')) {
      const stem = name.replace(/\.(tsx|ts)$/, '')
      out.push(stem === 'index' ? base || '/' : `${base}/${stem}`)
    }
  }
  return out
}

test('every page is deliberately public or deliberately protected', () => {
  const pages = pageRoutes(join(process.cwd(), 'src', 'pages'))
  assert.ok(pages.length > 20, 'found the pages directory')
  const unclassified = pages.filter(p => !isProtected(p) && !isEmployeePage(p) && !isPublicPage(p))
  assert.deepEqual(
    unclassified, [],
    `These pages are in neither list. Add each to PROTECTED_PATHS or PUBLIC_PATHS in src/lib/server/routes.ts: ${unclassified.join(', ')}`,
  )
})

test('no page is both public and protected', () => {
  for (const p of PUBLIC_PATHS) assert.equal(isProtected(p) || isEmployeePage(p), false, p)
})

test('protection covers whole path segments, not just prefixes', () => {
  assert.equal(isProtected('/anomalies/ANO-12'), true)
  assert.equal(isProtected('/audit-logs'), true)
  // A path that merely STARTS with a protected name is a different page.
  assert.equal(isProtected('/dashboardx'), false)
  assert.equal(isProtected('/audit'), false)
})

test('the pages that were open to anyone are now protected', () => {
  for (const p of ['/reports', '/uploads', '/import-center', '/upload-data', '/audit-logs', '/welcome', '/onboarding']) {
    assert.equal(isProtected(p), true, p)
  }
  assert.ok(PROTECTED_PATHS.includes('/audit-logs'))
})
