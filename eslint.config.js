const globals         = require('globals');
const tsParser        = require('@typescript-eslint/parser');
const tsPlugin        = require('@typescript-eslint/eslint-plugin');
const hammerhead      = require('eslint-plugin-hammerhead');
const noOnlyTests     = require('eslint-plugin-no-only-tests');
const { fixupPluginRules } = require('@eslint/compat');
const { builtinRules } = require('eslint/use-at-your-own-risk');

const compatTsPlugin = {
    ...tsPlugin,
    rules: {
        ...tsPlugin.rules,
        'no-extra-parens': builtinRules.get('no-extra-parens'),
    },
};
const compatHammerhead = fixupPluginRules(hammerhead);
const hammerheadRecommendedRules = compatHammerhead.configs?.recommended?.rules || {};

module.exports = [
    {
        ignores: [
            'src/client/json.js',
            'src/processing/script/tools',
        ],
    },

    {
        files: ['**/*.{js,ts}'],
        languageOptions: {
            parser: tsParser,
            sourceType: 'module',
            ecmaVersion: 2021,
            globals: {
                ...globals.es2021,
                ...globals.node,
            },
        },
        plugins: {
            '@typescript-eslint': compatTsPlugin,
        },
        rules: {
            'no-alert':                               2,
            'no-array-constructor':                   2,
            'no-caller':                              2,
            'no-eval':                                2,
            'no-extend-native':                       2,
            'no-extra-bind':                          2,
            'no-implied-eval':                        2,
            'no-iterator':                            2,
            'no-label-var':                           2,
            'no-labels':                              2,
            'no-lone-blocks':                         2,
            'no-loop-func':                           2,
            'no-multi-str':                           2,
            'no-global-assign':                       2,
            'no-new':                                 2,
            'no-new-func':                            0,
            'no-object-constructor':                  2,
            'no-new-wrappers':                        2,
            'no-octal-escape':                        2,
            'no-process-exit':                        2,
            'no-proto':                               2,
            'no-return-assign':                       2,
            'no-script-url':                          2,
            'no-sequences':                           2,
            'no-shadow':                              2,
            'no-shadow-restricted-names':             2,
            'no-spaced-func':                        2,
            'no-trailing-spaces':                     2,
            'no-undef-init':                          2,
            'no-unused-expressions':                  2,
            'no-var':                                 2,
            'no-with':                                2,
            'camelcase':                              2,
            'comma-spacing':                          2,
            'consistent-return':                      2,
            'eqeqeq':                                 2,
            'semi':                                   2,
            'semi-spacing':                           [2, { before: false, after: true }],
            'space-infix-ops':                        2,
            'space-unary-ops':                        [2, { words: true, nonwords: false }],
            'yoda':                                   [2, 'never'],
            'brace-style':                            [2, 'stroustrup', { allowSingleLine: false }],
            'eol-last':                               2,
            'indent':                                 [2, 4, { SwitchCase: 1 }],
            'key-spacing':                            [2, { align: 'value' }],
            'max-nested-callbacks':                   [2, 3],
            'new-parens':                             2,
            'no-lonely-if':                           2,
            'no-multiple-empty-lines':                [2, { max: 2 }],
            'no-nested-ternary':                      2,
            'no-underscore-dangle':                   0,
            'no-unneeded-ternary':                    2,
            'object-curly-spacing':                   [2, 'always'],
            'object-curly-newline':                   [2, { ImportDeclaration: { minProperties: 3, consistent: true } }],
            'operator-assignment':                    [2, 'always'],
            'quotes':                                 [2, 'single', { avoidEscape: true, allowTemplateLiterals: true }],
            'keyword-spacing':                        2,
            'space-before-blocks':                    [2, 'always'],
            'prefer-const':                           2,
            'no-path-concat':                         2,
            'no-undefined':                           2,
            'strict':                                 0,
            'curly':                                  [2, 'multi-or-nest'],
            'dot-notation':                           0,
            'no-else-return':                         2,
            'one-var':                                [2, 'never'],
            'no-multi-spaces':                        [2, {
                exceptions: {
                    VariableDeclarator:  true,
                    AssignmentExpression: true,
                },
            }],
            'radix':                                  2,
            'new-cap':                                [2, { capIsNew: false }],
            'space-before-function-paren':            [2, 'always'],
            'linebreak-style':                        [2, 'unix'],
            'no-duplicate-imports':                   2,
            'comma-dangle':                           ['error', {
                arrays:    'always-multiline',
                objects:   'always-multiline',
                imports:   'always-multiline',
                exports:   'always-multiline',
                functions: 'always-multiline',
            }],
            '@typescript-eslint/no-extra-parens':     2,
            '@typescript-eslint/no-use-before-define': [2, 'nofunc'],
            '@typescript-eslint/no-var-requires':     [0],
            '@typescript-eslint/explicit-function-return-type': [2, { allowExpressions: true }],
            '@typescript-eslint/no-unused-vars':      [2, { caughtErrors: 'none' }],
        },
    },

    {
        files: ['src/**/*.{js,ts}'],
        languageOptions: {
            parser: tsParser,
            sourceType: 'module',
        },
        plugins: {
            '@typescript-eslint': compatTsPlugin,
            hammerhead: compatHammerhead,
        },
        rules: {
            '@typescript-eslint/explicit-member-accessibility': 0,
            '@typescript-eslint/no-explicit-any':               0,
            '@typescript-eslint/explicit-function-return-type':  0,
            '@typescript-eslint/no-use-before-define':           0,
            '@typescript-eslint/no-object-literal-type-assertion': 0,
            '@typescript-eslint/no-parameter-properties':        0,
            '@typescript-eslint/explicit-module-boundary-types': 0,
            '@typescript-eslint/ban-ts-comment':                 0,
            'prefer-rest-params':                               0,
            'prefer-spread':                                    0,
            '@typescript-eslint/ban-types':                     0,
            '@typescript-eslint/no-this-alias':                 0,
        },
    },

    {
        files: ['src/client/**/*.{js,ts}'],
        plugins: {
            hammerhead: compatHammerhead,
        },
        rules: {
            ...hammerheadRecommendedRules,
            'hammerhead/proto-methods':  2,
            'no-restricted-globals':     [2, 'Promise'],
        },
        languageOptions: {
            globals: {
                ...globals.browser,
                initHammerheadClient: 'readonly',
            },
        },
    },

    {
        files: ['src/processing/script/**/*.{js,ts}'],
        plugins: {
            hammerhead: compatHammerhead,
        },
        rules: {
            'hammerhead/proto-methods': 2,
        },
    },

    {
        files: ['src/processing/dom/**/*.{js,ts}'],
        plugins: {
            hammerhead: compatHammerhead,
        },
        rules: {
            'hammerhead/proto-methods': 2,
        },
    },

    {
        files: ['test/**/*.{js,ts}'],
        plugins: {
            'no-only-tests': noOnlyTests,
        },
        rules: {
            'no-unused-expressions':                        0,
            'max-nested-callbacks':                         [2, 6],
            'no-only-tests/no-only-tests':                  2,
            '@typescript-eslint/explicit-function-return-type': 0,
            '@typescript-eslint/no-empty-function':         0,
        },
    },

    {
        files: ['test/client/**/*.{js,ts}'],
        rules: {
            'no-eval':                   0,
            'no-implied-eval':           0,
            'max-nested-callbacks':      0,
            'no-script-url':             0,
            'no-loop-func':              0,
            'no-redeclare':              0,
            'no-prototype-builtins':     0,
            'no-var':                    0,
        },
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.qunit,
                jquery:                'readonly',
                async:                 'readonly',
                callMethod:            'readonly',
                getProperty:           'readonly',
                setProperty:           'readonly',
                processScript:         'readonly',
                getLocation:           'readonly',
                hammerhead:            'readonly',
                processDomMeth:        'readonly',
                initIframeTestHandler: 'readonly',
                checkNativeFunctionArgs: 'readonly',
                createTestIframe:      'readonly',
                waitForMessage:        'readonly',
                getCrossDomainPageUrl: 'readonly',
                getSameDomainPageUrl:  'readonly',
                removeDoubleQuotes:    'readonly',
            },
        },
    },

    {
        files: ['test/server/**/*.{js,ts}'],
        rules: {
            'max-nested-callbacks': 0,
            'no-var':               2,
        },
        languageOptions: {
            globals: {
                ...globals.mocha,
            },
        },
    },
];