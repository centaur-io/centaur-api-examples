import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypes from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypes,
  // Remote feed media comes from the API. It uses direct, lazy image loads, not a server proxy.
  { rules: { '@next/next/no-img-element': 'off' } },
  globalIgnores(['.next/**', 'next-env.d.ts', 'test-results/**', 'playwright-report/**']),
])
