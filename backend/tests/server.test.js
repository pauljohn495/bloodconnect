const { after, before, test } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const { app } = require('../server')

let server
let baseUrl

function tokenFor(role, id = 1) {
  const secret = process.env.JWT_SECRET || 'dev-secret'
  return jwt.sign({ id, role, email: `${role}@example.test` }, secret, {
    algorithm: 'HS256',
    expiresIn: '5m',
  })
}

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      baseUrl = `http://127.0.0.1:${port}`
      resolve()
    })
  })
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
})

test('unknown API routes return a standardized 404 response and security headers', async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`)
  const body = await response.json()

  assert.equal(response.status, 404)
  assert.equal(body.status, 'error')
  assert.equal(body.message, 'API route not found')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('x-frame-options'), 'DENY')
  assert.equal(response.headers.get('x-powered-by'), null)
})

test('authentication endpoints rate-limit repeated attempts', async () => {
  let response
  for (let attempt = 0; attempt < 16; attempt += 1) {
    response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.25',
      },
      body: JSON.stringify({}),
    })
  }

  assert.equal(response.status, 429)
  assert.equal(response.headers.get('ratelimit-remaining'), '0')
  assert.ok(Number(response.headers.get('retry-after')) > 0)
})

test('JSON endpoints reject missing request bodies without a server error', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'X-Forwarded-For': '198.51.100.26' },
  })
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.message, 'Identifier is required')
})

test('registration rejects weak credentials and invalid blood types before database access', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register-donor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.27' },
    body: JSON.stringify({
      fullName: 'Test Donor',
      username: 'test-donor',
      password: 'short',
      phone: '09171234567',
      bloodType: 'invalid',
    }),
  })

  assert.equal(response.status, 400)
  assert.match((await response.json()).message, /Password must be/)
})

test('donor-only endpoints reject other authenticated roles', async () => {
  const response = await fetch(`${baseUrl}/api/user/donations`, {
    headers: { Authorization: `Bearer ${tokenFor('hospital')}` },
  })
  assert.equal(response.status, 403)
})

test('profile and hospital request validators reject unsafe payloads before database access', async () => {
  const [profileResponse, requestResponse] = await Promise.all([
    fetch(`${baseUrl}/api/user/me`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${tokenFor('donor')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ profileImageUrl: 'javascript:alert(1)' }),
    }),
    fetch(`${baseUrl}/api/hospital/requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenFor('hospital')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bloodType: 'X+', unitsRequested: 1 }),
    }),
  ])

  assert.equal(profileResponse.status, 400)
  assert.equal(requestResponse.status, 400)
})
