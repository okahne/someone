/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: ['./tsconfig.base.json', './apps/*/tsconfig.json', './packages/*/tsconfig.json'],
        tsconfigRootDir: __dirname,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
    ],
    rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/explicit-function-return-type': 'warn',
        'no-console': 'warn',
    },
    ignorePatterns: ['dist/', 'node_modules/', '.eslintrc.js', '*.js'],
    overrides: [
        {
            files: ['apps/frontend/**/*.ts'],
            extends: [
                'plugin:@angular-eslint/recommended',
                'plugin:@angular-eslint/template/process-inline-templates',
            ],
            rules: {
                '@angular-eslint/directive-selector': [
                    'error',
                    { type: 'attribute', prefix: 'app', style: 'camelCase' },
                ],
                '@angular-eslint/component-selector': [
                    'error',
                    { type: 'element', prefix: 'app', style: 'kebab-case' },
                ],
            },
        },
        {
            files: ['apps/frontend/**/*.html'],
            extends: ['plugin:@angular-eslint/template/recommended'],
            rules: {},
        },
        {
            files: ['**/*.spec.ts', '**/*.int-spec.ts'],
            rules: {
                '@typescript-eslint/no-explicit-any': 'off',
                '@typescript-eslint/explicit-function-return-type': 'off',
            },
        },
    ],
};
