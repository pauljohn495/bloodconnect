import assert from 'node:assert/strict'

let initializeCalls = 0
let renderCalls = 0
let configuredCallback
let initializationOptions
const received = []

globalThis.window = {
  google: {
    accounts: {
      id: {
        initialize(options) {
          initializeCalls += 1
          initializationOptions = options
          configuredCallback = options.callback
        },
        renderButton() {
          renderCalls += 1
        },
      },
    },
  },
}

const { mountGoogleIdentityButton } = await import('../src/googleIdentity.js')
const container = { isConnected: false, replaceChildren() {} }

const unmountFirst = await mountGoogleIdentityButton({
  clientId: 'test-client.apps.googleusercontent.com',
  container,
  onCredential: response => received.push(['first', response.credential]),
  options: { theme: 'outline' },
})
unmountFirst()

await mountGoogleIdentityButton({
  clientId: 'test-client.apps.googleusercontent.com',
  container,
  onCredential: response => received.push(['second', response.credential]),
  options: { theme: 'outline' },
})

configuredCallback({ credential: 'credential-value' })

assert.equal(initializeCalls, 1, 'GIS must initialize once across component mounts')
assert.equal(renderCalls, 2, 'each component mount should render its own button')
assert.deepEqual(received, [['second', 'credential-value']], 'credentials must use the active page handler')
assert.equal(initializationOptions.use_fedcm_for_button, true, 'FedCM button flow must be enabled')

await assert.rejects(
  mountGoogleIdentityButton({
    clientId: 'different-client.apps.googleusercontent.com',
    container,
    onCredential() {},
    options: {},
  }),
  /client ID changed/,
)

console.log('Google Identity singleton and FedCM checks: 5/5 passed')
