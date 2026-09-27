const STATE_KEY = '__bloodconnectGoogleIdentityState'
const GIS_SCRIPT_SELECTOR = 'script[src^="https://accounts.google.com/gsi/client"]'

function getState() {
  if (typeof window === 'undefined') return null
  if (!window[STATE_KEY]) {
    Object.defineProperty(window, STATE_KEY, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: {
        activeCredentialHandler: null,
        clientId: null,
        loadPromise: null,
      },
    })
  }
  return window[STATE_KEY]
}

function waitForGoogleIdentity() {
  const state = getState()
  if (!state) return Promise.reject(new Error('Google sign-in requires a browser'))
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (state.loadPromise) return state.loadPromise

  state.loadPromise = new Promise((resolve, reject) => {
    const script = document.querySelector(GIS_SCRIPT_SELECTOR)
    if (!script) {
      reject(new Error('Google Identity Services script was not found'))
      return
    }

    let timeoutId
    const cleanup = () => {
      script.removeEventListener('load', loaded)
      script.removeEventListener('error', failed)
      window.clearTimeout(timeoutId)
    }
    const loaded = () => {
      cleanup()
      if (window.google?.accounts?.id) resolve(window.google.accounts.id)
      else reject(new Error('Google Identity Services did not initialize'))
    }
    const failed = () => {
      cleanup()
      reject(new Error('Google Identity Services failed to load'))
    }

    script.addEventListener('load', loaded, { once: true })
    script.addEventListener('error', failed, { once: true })
    timeoutId = window.setTimeout(failed, 10000)
  }).catch((error) => {
    state.loadPromise = null
    throw error
  })

  return state.loadPromise
}

export async function mountGoogleIdentityButton({
  clientId,
  container,
  onCredential,
  options,
}) {
  if (!clientId || !container || typeof onCredential !== 'function') {
    throw new Error('Google sign-in is not configured')
  }

  const googleIdentity = await waitForGoogleIdentity()
  const state = getState()
  if (state.clientId && state.clientId !== clientId) {
    throw new Error('Google sign-in client ID changed after initialization')
  }

  state.activeCredentialHandler = onCredential
  if (!state.clientId) {
    googleIdentity.initialize({
      client_id: clientId,
      callback: (response) => state.activeCredentialHandler?.(response),
    })
    state.clientId = clientId
  }

  container.replaceChildren()
  googleIdentity.renderButton(container, options)

  return () => {
    if (state.activeCredentialHandler === onCredential) state.activeCredentialHandler = null
    if (container.isConnected) container.replaceChildren()
  }
}
