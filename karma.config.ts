module.exports = function (config) {
	config.set({
		frameworks: [
			'browserify',
			'jasmine'
		],
		preprocessors: {
			'**/*.ts': ['browserify']
		},
		files: [
			// ES6 shims.
			// Could be removed when everything in ES6 is implemented.
			'node_modules/core-js/client/shim.js',
			// Potion/Angular 2 dependency.
			'node_modules/reflect-metadata/Reflect.js',
			// Fetch should be available in the browser.
			// This is here just to shim it in PhantomJS or browsers that do not have it.
			'node_modules/whatwg-fetch/fetch.js',
			'src/**/*.spec.ts'
		],
		reporters: ['spec'],
		browserify: {
			debug: true,
			extensions: ['.js', '.ts'],
			transform: [
				['babelify', {presets: ['es2015', 'stage-0'],  extensions: ['.ts', '.js']}]
			],
			plugin: ['tsify']
		},
		plugins: [
			'karma-browserify',
			'karma-chrome-launcher',
			'karma-jasmine',
			'karma-phantomjs-launcher',
			'karma-spec-reporter'
		],
		logLevel: config.LOG_INFO,
		browsers: [
			'PhantomJS'
		]
	});
};
