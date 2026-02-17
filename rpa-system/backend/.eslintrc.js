module.exports = {
  root: true,
  overrides: [
    {
      files: [
        'scripts/**',
        'scripts/*.js',
        'seed-*.js',
        'run-*.js',
        'tests/**',
        'tests/*.js',
        'migrations/**',
        'bin/**'
      ],
      rules: {
        'no-console': 'off',
        'no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^(getLogger|getSupabase|getSupabaseOrThrow|createClient|createContextLogger|getFrontendConfigInfo|createLogger|_?logger|_?getLogger)$'
          }
        ]
      }
    },
    {
      files: ['**/*.test.js', '**/*.e2e.test.js'],
      rules: {
        'no-console': 'off'
      }
    }
  ]
};
module.exports = {
 env: {
 node: true,
 es2021: true,
 jest: true
 },
 globals: {
 // Puppeteer page.evaluate() runs in browser context
 document: 'readonly',
 window: 'readonly'
 },
 extends: [
 'eslint:recommended'
 ],
 parserOptions: {
 ecmaVersion: 2021,
 sourceType: 'module'
 },
 rules: {
 'no-console': 'warn',
 'no-unused-vars': ['warn', {
 argsIgnorePattern: '^_',
 varsIgnorePattern: '^_'
 }],
 'no-undef': 'error',
 'semi': ['error', 'always'],
 'quotes': ['error', 'single', { avoidEscape: true }],
 'comma-dangle': ['error', 'never'],
 'no-trailing-spaces': 'error',
 'eol-last': ['error', 'always']
 },
 ignorePatterns: [
 'node_modules/',
 'coverage/',
 '*.min.js',
 'dist/',
 'build/'
 ]
};

