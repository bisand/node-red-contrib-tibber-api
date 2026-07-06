import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.browser,
                ...globals.mocha,
                Atomics: 'readonly',
                SharedArrayBuffer: 'readonly',
            },
        },
    },
    {
        ignores: ['node_modules/**', 'examples/**'],
    },
];
