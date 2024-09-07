'use strict'

const path = require('node:path')

const { includeIgnoreFile } = require('@eslint/compat')
const tsEslint = require('typescript-eslint')
const tsParser = require('@typescript-eslint/parser')

const gitignorePath = path.resolve(__dirname, '.gitignore')
const prettierignorePath = path.resolve(__dirname, '.prettierignore')

module.exports = [
  includeIgnoreFile(gitignorePath),
  includeIgnoreFile(prettierignorePath),
  {
    files: ['packages/**/*.{js,ts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json'],
        projectService: true
      }
    },
    plugins: {
      '@typescript-eslint': tsEslint.plugin
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'off'
    },
    rules: {
      '@typescript-eslint/no-floating-promises': ['error'],
      '@typescript-eslint/no-misused-promises': ['error'],
      // Returning unawaited promises in a try/catch/finally is dangerous
      // (the `catch` won't catch if the promise is rejected, and the `finally`
      // won't wait for the promise to resolve). Returning unawaited promises
      // elsewhere is probably fine, but this lint rule doesn't have a way
      // to only apply to try/catch/finally (the 'in-try-catch' option *enforces*
      // not awaiting promises *outside* of try/catch/finally, which is not what
      // we want), and it's nice to await before returning anyways, since you get
      // a slightly more comprehensive stack trace upon promise rejection.
      '@typescript-eslint/return-await': ['error', 'always'],
      'no-warning-comments': ['warn', { terms: ['fixme'] }]
    }
  }
]
