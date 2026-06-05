import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['node_modules/**', 'dist/**', 'demo-agent/**', 'demo-service/**', 'src/capabilities/**/files/**'],
  },
});
