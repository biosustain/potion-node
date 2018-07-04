const nodeModules = 'node_modules';
const zoneJs = `${nodeModules}/zone.js/dist`;


module.exports = function (config) {
    config.set({
        frameworks: [
            'jasmine',
            'karma-typescript'
        ],
        reporters: ['spec', 'karma-typescript'],
        preprocessors: {
            '**/*.ts': ['karma-typescript']
        },
        files: [
            // ES6/ES7 shims
            `${nodeModules}/core-js/client/shim.min.js`,
            {pattern: `${nodeModules}/core-js/client/shim.min.js.map`, included: false, served: true},
            `${nodeModules}/reflect-metadata/Reflect.js`,
            // Angular 4+ requirements
            `${zoneJs}/zone.js`,
            `${zoneJs}/long-stack-trace-zone.js`,
            `${zoneJs}/proxy.js`,
            `${zoneJs}/sync-test.js`,
            `${zoneJs}/jasmine-patch.js`,
            `${zoneJs}/async-test.js`,
            `${zoneJs}/fake-async-test.js`,
            // Setup Angular 4+ test env
            {pattern: 'src/test.ts'},
            // Specs
            {pattern: 'src/**/*.ts'}
        ],
        karmaTypescriptConfig: {
            tsconfig: './src/tsconfig.spec.json',
            bundlerOptions: {
                entrypoints: /test\.ts|\.spec\.ts$/,
                transforms: []
            },
            coverageOptions: {
                exclude: /\.(d|spec|test)\.ts|src\/index\.ts$/i,
                threshold: {
                    global: {
                        statements: 90,
                        branches: 80,
                        functions: 90,
                        lines: 80
                    }
                }
            },
            reports: {
                html: '.coverage',
                'text-summary': ''
            }
        },
        coverageReporter: {
            instrumenterOptions: {
                istanbul: {noCompact: true}
            }
        },
        logLevel: config.LOG_INFO,
        browsers: [
            'Chrome'
        ],
        customLaunchers: {
            CHROME_HEADLESS: {
                base: 'Chrome',
                flags: [
                    '--headless',
                    '--remote-debugging-port=9000',
                    '--disable-gpu'
                ]
            }
        }
    });
};
