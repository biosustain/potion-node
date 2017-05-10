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
			tsconfig: './tsconfig.spec.json',
			bundlerOptions: {
				entrypoints: /karma-test-shim\.ts|\.spec\.ts$/,
				transforms: [
					require('karma-typescript-es6-transform')({
						presets: ['es2015', 'stage-0'],
						extensions: ['.ts', '.js'],
						plugins: [
							["transform-runtime", {
								regenerator: true,
								polyfill: true
							}]
						]
					})
				]
			}
		},
		logLevel: config.LOG_INFO,
		browsers: [
			'Chrome',
			'PhantomJS'
		]
	});
};
