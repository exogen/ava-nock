module.exports = {
  extends: ['standard', 'prettier'],
  parser: '@babel/eslint-parser',
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 6,
  },
  plugins: ['@babel', 'prettier'],
  rules: {
    'prettier/prettier': 'warn',
  },
};
