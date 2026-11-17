// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'coverage/*', 'android/*', 'ios/*'],
  },
  {
    // The domain layer must stay pure: no React, Expo, DB or network imports.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'react',
            'react-native',
            'expo*',
            '@supabase/*',
            'drizzle-orm*',
            '@/db/*',
            '@/sync/*',
            '@/services/*',
            '@/features/*',
          ],
        },
      ],
    },
  },
]);
