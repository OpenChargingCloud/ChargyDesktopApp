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
    }

);
