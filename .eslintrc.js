module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true, jest: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  settings: { react: { version: 'detect' } },
  rules: {
    'react/prop-types': 'off',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': 'warn',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
  },
  ignorePatterns: ['**/build/**','**/dist/**','**/node_modules/**']
};