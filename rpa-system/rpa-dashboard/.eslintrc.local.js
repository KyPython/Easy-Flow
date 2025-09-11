module.exports = {
  extends: ['./.eslintrc.js'],
  rules: {
    // Temporarily disable prop-types validation for workflow components
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off'
  }
};