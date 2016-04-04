module.exports = function (config) {
	config.set({
		frameworks: [
			'jasmine',
			'jspm'
		],
		reporters: [
			'spec'
		],
		jspm: {
			browser: 'jspm.browser.js',
			config: 'jspm.config.js',
			serveFiles: [
				'node_modules/typescript/lib/*.d.ts',
				'node_modules/reflect-metadata/**/*.d.ts',
				'typings/**/*.d.ts',
				'src/**/*!(*.spec).ts',
				'tsconfig.json'
			],
			loadFiles: ['src/**/*.spec.ts']
		},
		plugins: [
			'karma-chrome-launcher',
			'karma-firefox-launcher',
			'karma-jasmine',
			'karma-jspm',
			'karma-phantomjs-launcher',
			'karma-spec-reporter'
		],
		proxies: {
			'/jspm_packages/': '/base/jspm_packages/',
			'/src/': '/base/src/',
			'/tsconfig.json': '/base/tsconfig.json',
			'/node_modules/': '/base/node_modules/',
			'/typings/': '/base/typings/'
		},
		logLevel: config.LOG_INFO,
		browsers: [
			'PhantomJS'
		]
	});
};
