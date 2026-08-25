import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.tsx', '.mts', '.cts', '.mjs', '.js', '.jsx', '.json'],
  },
  ssr: {
    // DOM v3 ships ESM with extensionless internal imports; let Vite resolve them.
    noExternal: [/^@oozcitak\//],
  },
  test: {
    environment: 'node',
    globals: false,
    // QR-code verification loads parsers lazily and can exceed Vitest's 5 s default on Windows.
    testTimeout: 30_000,
    include: [
      ...configDefaults.include,
      '**/*.{test,tests,specs}.?(c|m)[jt]s?(x)',
    ],
    restoreMocks: true,
  },
})
