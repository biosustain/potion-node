module.exports = function (config) {
	config.set({
		frameworks: [
			'jasmine',
			'karma-typescript'
		],
		reporters: ['spec'],
		preprocessors: {
			'**/*.ts': ['karma-typescript']
		},
		files: [
			// Setup
			{pattern: 'config/karma-test-shim.ts'},
			// Specs
			{pattern: 'src/**/*.ts'}
		],
		karmaTypescriptConfig: {
			tsconfig: './src/tsconfig.spec.json',
			bundlerOptions: {
				entrypoints: /karma-test-shim\.ts|\.spec\.ts$/,
				transforms: []
			}
		},
		logLevel: config.LOG_INFO,
		browsers: [
			'Chrome'
		]
	});
};
