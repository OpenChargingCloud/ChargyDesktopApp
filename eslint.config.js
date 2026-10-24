import eslint    from '@eslint/js';
import tseslint  from 'typescript-eslint';

// Downgrade every rule of the shared presets from "error" to "warn", so the
// existing code keeps building while the findings are worked off file by file.
// Once a file is clean, its rules can be promoted back to "error" via an
// override at the bottom of this config.
function asWarnings(configs) {
    return configs.map(config => config.rules
        ? {
              ...config,
              rules: Object.fromEntries(
                  Object.entries(config.rules).map(([ruleId, entry]) => [
                      ruleId,
                      Array.isArray(entry)
                          ? [entry[0] === 'error' ? 'warn' : entry[0], ...entry.slice(1)]
                          : (entry === 'error' ? 'warn' : entry)
                  ])
              )
          }
        : config
    );
}

export default tseslint.config(

    {
        ignores: [
            '**/node_modules/**',
            'dist/**',
            'build/**',
            '**/*.js',
            '**/*.cjs',
            '**/*.mjs'
        ]
    },

    ...asWarnings([
        eslint.configs.recommended,
        ...tseslint.configs.strictTypeChecked
    ]),

    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        }
    },

    // Rules that are completely worked off are promoted back to "error"
    // for the whole code base, so they cannot silently regress:
    {
        rules: {
            "prefer-const":                                                "error",
            "@typescript-eslint/no-explicit-any":                          "error",
            "@typescript-eslint/no-empty-object-type":                     "error",
            "@typescript-eslint/no-base-to-string":                        "error",
            "@typescript-eslint/await-thenable":                           "error",
            "@typescript-eslint/adjacent-overload-signatures":             "error",
            "@typescript-eslint/explicit-function-return-type":            "error",
            "@typescript-eslint/explicit-module-boundary-types":           "error",
            "@typescript-eslint/no-extraneous-class":                      "error",
            "@typescript-eslint/no-duplicate-enum-values":                 "error",
            "@typescript-eslint/no-floating-promises":                     "error",
            "@typescript-eslint/no-implied-eval":                          "error",
            "@typescript-eslint/no-confusing-void-expression":             "error",
            "@typescript-eslint/no-array-delete":                          "error",
            "@typescript-eslint/no-dynamic-delete":                        "error",
            "@typescript-eslint/no-import-type-side-effects":              "error",
            "@typescript-eslint/no-invalid-void-type":                     "error",
            "@typescript-eslint/no-meaningless-void-operator":             "error",
            "@typescript-eslint/no-misused-promises":                      "error",
            "@typescript-eslint/no-non-null-assertion":                    "error",
            "@typescript-eslint/no-unnecessary-condition":                 "error",
            "@typescript-eslint/no-unnecessary-boolean-literal-compare":   "error",
            "@typescript-eslint/no-unnecessary-type-assertion":            "error",
            "@typescript-eslint/no-unnecessary-type-conversion":           "error",
            "@typescript-eslint/no-unnecessary-type-parameters":           "error",
            "@typescript-eslint/only-throw-error":                         "error",
            "@typescript-eslint/prefer-nullish-coalescing":                "error",
            "@typescript-eslint/prefer-optional-chain":                    "error",
            "@typescript-eslint/prefer-includes":                          "error",
            "@typescript-eslint/prefer-string-starts-ends-with":           "error",
            "@typescript-eslint/prefer-as-const":                          "error",
            "@typescript-eslint/prefer-find":                              "error",
            "@typescript-eslint/prefer-for-of":                            "error",
            "@typescript-eslint/prefer-function-type":                     "error",
            "@typescript-eslint/prefer-readonly":                          "error",
            "@typescript-eslint/promise-function-async":                   "error",
            "@typescript-eslint/require-array-sort-compare":               "error",
            "@typescript-eslint/no-unsafe-argument":                       "error",
            "@typescript-eslint/no-unsafe-assignment":                     "error",
            "@typescript-eslint/no-unsafe-call":                           "error",
            "@typescript-eslint/no-unsafe-enum-comparison":                "error",
            "@typescript-eslint/no-unsafe-member-access":                  "error",
            "@typescript-eslint/no-unsafe-return":                         "error",
            "@typescript-eslint/consistent-type-imports":                  "error",
            "@typescript-eslint/require-await":                            "error",
            "@typescript-eslint/no-non-null-asserted-optional-chain":      "error",
            "@typescript-eslint/no-useless-constructor":                   "error",
            "@typescript-eslint/return-await":                             [ "error", "in-try-catch" ],
            "@typescript-eslint/restrict-plus-operands":                   "error",
            "@typescript-eslint/restrict-template-expressions":            [ "error", { allowNumber: true } ],
            "@typescript-eslint/strict-boolean-expressions":               "error",
            "@typescript-eslint/switch-exhaustiveness-check":              [ "error", { considerDefaultExhaustiveForUnions: true } ],
            "@typescript-eslint/unified-signatures":                       "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_"
                }
            ],
            "no-case-declarations":                                        "off",
            "no-sparse-arrays":                                            "off",
            "no-prototype-builtins":                                       "off"
        }
    },

    // Warning-free files are promoted back to the original "error" severity,
    // so they cannot silently regress:
    {
        files: [
            'src/ts/OCPI.ts',
            'src/ts/QIDigital_DCoA.ts',
            'src/ts/QIDigital_DCoC.ts',
            'src/ts/QIDigital_DCC.ts',
            'src/ts/chargyLib.ts',
            'src/ts/qrReader.ts',
            'src/ts/ACrypt.ts',
            'src/ts/CanonicalJSON.ts',
            'src/ts/CryptoUtils.ts'
        ],
        rules: Object.assign({}, ...tseslint.configs.strictTypeChecked.map(config => config.rules ?? {}))
    }

);
