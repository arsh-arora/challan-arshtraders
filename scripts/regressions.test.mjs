// Diagnostic fixtures only: no live credentials, requests, or database writes.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'
import { NextRequest, NextResponse } from 'next/server.js'
import { AuthRetryableFetchError } from '@supabase/supabase-js'
import { PDFDocument } from 'pdf-lib'

const nativeRequire = createRequire(import.meta.url)
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))

function loadTypeScript(filename, imports = {}, globals = {}) {
  const source = fs.readFileSync(path.join(scriptDirectory, '..', filename), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const compiledModule = { exports: {} }
  // Keep PDF byte arrays in the same JavaScript realm as pdf-lib, while
  // injecting only the external boundaries exercised by each regression.
  const evaluate = vm.runInThisContext(
    `(function(require, module, exports, process, console, fetch, window, document) { ${outputText}\n })`,
    { filename }
  )
  evaluate(
    (name) => Object.hasOwn(imports, name) ? imports[name] : nativeRequire(name),
    compiledModule,
    compiledModule.exports,
    globals.process || process,
    { error() {} },
    globals.fetch,
    globals.window,
    globals.document
  )
  return compiledModule.exports
}

function pdfFixture() {
  const results = {
    doc: {
      data: {
        doc_no: 'DIAGNOSTIC',
        doc_date: '2026-07-01',
        source: { name: 'Fixture warehouse' },
        destination: { name: 'Fixture hospital' },
      },
      error: null,
    },
    lines: { data: [], error: null },
  }
  const supabase = { from() {
    return {
      select() { return this },
      eq() { return this },
      single() { return Promise.resolve(results.doc) },
      order() { return Promise.resolve(results.lines) },
    }
  } }
  let authError = null
  const route = loadTypeScript('src/app/api/document/[id]/pdf/route.tsx', {
    '@/lib/supabase/server': { createServerSupabaseAdmin: async () => supabase },
    '@/lib/config': { getAppConfig: () => ({ business: {
      name: 'Fixture business', address: 'Fixture address', gstin: 'Fixture GSTIN',
      email: 'fixture@example.test', website: 'example.test', logoFile: 'fixture-missing.png',
    } }) },
    '@/lib/auth': {
      requireAllowedUser: async () => { if (authError) throw authError },
      isAuthorizationError: (error) => error === authError,
    },
    '@/lib/numberToWords': loadTypeScript('src/lib/numberToWords.ts'),
  })
  return {
    results,
    denyAccess: () => { authError = { message: 'Sign in again.', status: 403 } },
    render: () => route.GET(undefined, { params: Promise.resolve({ id: 'fixture-only' }) }),
  }
}

test('PDF database failure is reported rather than downloaded as an empty document', async () => {
  const fixture = pdfFixture()
  fixture.results.lines = { data: null, error: { message: 'Private database details' } }
  const response = await fixture.render()
  assert.equal(response.status, 503)
  const payload = await response.json()
  assert.match(payload.error, /document items/)
  assert.equal(JSON.stringify(payload).includes('Private database details'), false)
})

test('PDF distinguishes a missing document from database unavailability', async () => {
  const fixture = pdfFixture()
  fixture.results.doc = { data: null, error: { code: 'PGRST116' } }
  assert.equal((await fixture.render()).status, 404)
  fixture.results.doc = { data: null, error: { code: 'PGRST002', message: 'Database unavailable' } }
  assert.equal((await fixture.render()).status, 503)
})

test('PDF export rejects unauthorized access', async () => {
  const fixture = pdfFixture()
  fixture.denyAccess()
  assert.equal((await fixture.render()).status, 403)
})

test('PDF renders special characters and multiple pages', async () => {
  const fixture = pdfFixture()
  fixture.results.lines.data = Array.from({ length: 80 }, (_, index) => ({
    material_code: `FIXTURE-${index}`,
    material_description: 'HOPKINS 30°, Ø 10 mm ₹ परीक्षण',
    company_delivery_no: 'FIXTURE', qty: 1,
    challan_line: { hsn_code: 'FIXTURE', unit_cost: 100 },
  }))
  const response = await fixture.render()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
  const pdf = await PDFDocument.load(bytes)
  assert.ok(pdf.getPageCount() > 1)
})

function middlewareFixture(getUser, env = {}) {
  let calls = 0
  const { middleware } = loadTypeScript('src/middleware.ts', {
    '@supabase/ssr': { createServerClient(_url, _key, options) {
      calls += 1
      return { auth: { getUser: () => getUser(options.cookies) } }
    } },
  }, { process: { env: { AUTH_REQUIRE_ALLOWLIST: 'true', AUTH_ALLOWED_EMAILS: 'allowed@example.test', ...env } } })
  return {
    calls: () => calls,
    request: (pathname) => middleware(new NextRequest(`https://fixture.example.test${pathname}`)),
  }
}

test('middleware contains unexpected exceptions and keeps login accessible', async () => {
  const fixture = middlewareFixture(async () => { throw new Error('Private network details') })
  const response = await fixture.request('/api/document/fixture/pdf')
  assert.equal(response.status, 503)
  assert.equal((await response.text()).includes('Private network details'), false)
  assert.equal((await fixture.request('/document')).status, 503)
  assert.equal((await fixture.request('/login')).status, 200)
})

test('middleware contains missing Supabase configuration', async () => {
  const { middleware } = loadTypeScript('src/middleware.ts', {}, { process: { env: {} } })
  assert.equal((await middleware(new NextRequest('https://fixture.example.test/document'))).status, 503)
})

test('middleware treats a retryable authentication error as unavailability', async () => {
  const fixture = middlewareFixture(async () => ({ data: { user: null }, error: new AuthRetryableFetchError('Fixture outage', 0) }))
  assert.equal((await fixture.request('/api/document/fixture/pdf')).status, 503)
})

test('middleware returns JSON for missing or disallowed API sessions', async () => {
  const missing = middlewareFixture(async () => ({ data: { user: null }, error: null }))
  const response = await missing.request('/api/document/fixture/pdf')
  assert.equal(response.status, 401)
  assert.match((await response.json()).error, /sign in again/)
  assert.equal((await missing.request('/document')).status, 307)
  const denied = middlewareFixture(async () => ({ data: { user: { email: 'denied@example.test' } }, error: null }))
  assert.equal((await denied.request('/api/document/fixture/pdf')).status, 403)
})

test('middleware forwards refreshed cookies upstream and on redirects', async () => {
  const fixture = middlewareFixture(async (cookies) => {
    cookies.setAll([{ name: 'fixture-session', value: 'refreshed', options: { httpOnly: true, path: '/' } }])
    return { data: { user: { email: 'allowed@example.test' } }, error: null }
  })
  const response = await fixture.request('/document')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('x-middleware-request-cookie'), /fixture-session=refreshed/)
  assert.equal(response.cookies.get('fixture-session').value, 'refreshed')
  const redirect = await fixture.request('/login')
  assert.equal(redirect.status, 307)
  assert.equal(redirect.cookies.get('fixture-session').value, 'refreshed')
})

test('middleware leaves OAuth callback and health authentication to their handlers', async () => {
  const fixture = middlewareFixture(async () => { throw new Error('Should not run') })
  assert.equal((await fixture.request('/auth/callback')).status, 200)
  assert.equal((await fixture.request('/api/health/supabase')).status, 200)
  assert.equal(fixture.calls(), 0)
})

function downloadFixture(response) {
  const events = []
  const anchor = { click: () => events.push('click'), remove: () => events.push('remove') }
  const { downloadFile } = loadTypeScript('src/lib/download.ts', {}, {
    fetch: async () => response,
    window: { URL: { createObjectURL: () => 'blob:fixture', revokeObjectURL: () => events.push('revoke') } },
    document: { createElement: () => anchor, body: { appendChild: () => events.push('append') } },
  })
  return {
    events,
    anchor,
    download: () => downloadFile({ url: '/fixture-only', filename: 'fixture.pdf', contentType: 'application/pdf' }),
  }
}

test('download displays the public API error without internal details', async () => {
  const fixture = downloadFixture(NextResponse.json({ error: 'Unable to load the document items.', details: 'Private details' }, { status: 503 }))
  await assert.rejects(fixture.download, /Unable to load the document items\./)
  assert.deepEqual(fixture.events, [])
})

test('download rejects login redirects and HTML responses', async () => {
  const redirected = downloadFixture({ redirected: true })
  await assert.rejects(redirected.download, /session has expired/)
  const html = downloadFixture(new Response('<html>Sign in</html>', { headers: { 'content-type': 'text/html' } }))
  await assert.rejects(html.download, /did not return the requested file/)
  assert.deepEqual(html.events, [])
})

test('download handles a non-JSON server error', async () => {
  const fixture = downloadFixture(new Response('Server unavailable', { status: 503 }))
  await assert.rejects(fixture.download, /HTTP 503/)
})

test('download saves a PDF and cleans up the temporary URL', async () => {
  const fixture = downloadFixture(new Response('%PDF-fixture', { headers: { 'content-type': 'application/pdf' } }))
  await fixture.download()
  assert.equal(fixture.anchor.download, 'fixture.pdf')
  assert.deepEqual(fixture.events, ['append', 'click', 'remove', 'revoke'])
})
