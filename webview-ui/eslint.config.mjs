// Flat config for webview-ui (ESLint v9+ recommended)
export default [
  { ignores: ['build/**','node_modules/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-undef': 'off',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
]

