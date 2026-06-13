import tseslint from 'typescript-eslint';

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

    ...asWarnings(tseslint.configs.strictTypeChecked),

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
            'prefer-const':                                            'error',
            '@typescript-eslint/no-non-null-asserted-optional-chain':  'error',
            '@typescript-eslint/restrict-template-expressions':        'error',
            '@typescript-eslint/no-empty-object-type':                 'error',
            '@typescript-eslint/no-useless-constructor':               'error',
            '@typescript-eslint/only-throw-error':                     'error'
        }
    },

    // Warning-free files are promoted back to the original "error" severity,
    // so they cannot silently regress:
    {
        files: [
            'src/ts/OCPI.ts',
            'src/ts/QIDigital_DCoA.ts',
            'src/ts/QIDigital_DCoC.ts',
            'src/ts/chargyLib.ts',
            'src/ts/qrReader.ts',
            'src/ts/ACrypt.ts',
            'src/ts/CanonicalJSON.ts',
            'src/ts/CryptoUtils.ts'
        ],
        rules: Object.assign({}, ...tseslint.configs.strictTypeChecked.map(config => config.rules ?? {}))
    }

);
