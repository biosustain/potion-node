const camelCase = require('camelcase');
const sourcemaps = require('rollup-plugin-sourcemaps');
const uglify = require('rollup-plugin-uglify');

const name = require('./package.json').name;

const plugins = [
    sourcemaps()
];
if (process.env.UGLIFY) {
    plugins.push(...[
        uglify()
    ]);
}


export default {
    plugins,
    name: name.replace('@', '')
        .split('/')
        .map(str => camelCase(str))
        .join('.'),
    sourcemap: true,

    // ATTENTION:
    // Add any dependency or peer dependency the library uses to `globals` and `external`.
    // This is required for UMD bundle users.
    globals: {
        // The key here is library name, and the value is the the name of the global variable name the window object.
        // See https://github.com/rollup/rollup/wiki/JavaScript-API#globals for more.
        // Angular
        '@angular/core': 'ng.core',
        '@angular/common/http': 'ng.common.http',
        'angular': 'angular',
        // RxJs
        'rxjs/operators/filter': 'Rx.operators',
        'rxjs/operators/map': 'Rx.operators',
        // TS
        'tslib': 'tslib'
    },
    external: [
        // List of dependencies
        // See https://github.com/rollup/rollup/wiki/JavaScript-API#external for more.
        // Angular
        '@angular/core',
        '@angular/common/http',
        'angular',
        // RxJs
        'rxjs/operators/filter',
        'rxjs/operators/map',
        // TS
        'tslib'
    ]
}
