/**
 * Simplified app params for local development.
 * Base44-specific logic removed.
 */

export const appParams = {
  appId: 'local-app',
  token: null,
  fromUrl: typeof window !== 'undefined' ? window.location.href : '',
  functionsVersion: '1.0.0',
  appBaseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:6942',
}
