
module.exports = function (config) {
	config.set({
		frameworks: [
			'jasmine',
			'jspm'
		],
		// singleRun : true,
		exclude: [],
		jspm: {
			browser: 'jspm.browser.js',
			config: 'jspm.config.js',
			serveFiles: ['src/**/*!(*.spec).ts', 'tsconfig.json', 'typings/**/*.d.ts'],
			loadFiles: ['src/**/*.spec.ts']
		},
		plugins: [
			'karma-jasmine',
			'karma-jspm',
			'karma-chrome-launcher'
		],
		proxies: {
			'/jspm_packages/': '/base/jspm_packages/',
			'/src/': '/base/src/',
			'/tsconfig.json': '/base/tsconfig.json',
			'/typings/': '/base/typings/'
		},
		browsers: [
			'Chrome'
		]
	});
};
