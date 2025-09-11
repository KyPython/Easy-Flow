module.exports = {
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: { jsx: true }
  },
  env: {
    browser: true,
    node: true,
    es2021: true,
    jest: true
  },
  plugins: ['react'],
  settings: {
    react: { version: 'detect' }
  },
  extends: ['plugin:react/recommended'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'warn', // Change from error to warning
    'react/no-unescaped-entities': 'warn' // Change from error to warning
  }
};
