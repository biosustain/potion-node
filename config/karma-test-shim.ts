Error.stackTraceLimit = Infinity;

// ES6/ES7 Shims
// NOTE: Could be removed when everything in ES6 is implemented.
import 'core-js';

import 'reflect-metadata';

// Angular Deps
import 'zone.js/dist/zone';
import 'zone.js/dist/long-stack-trace-zone';
import 'zone.js/dist/proxy';
import 'zone.js/dist/sync-test';
import 'zone.js/dist/jasmine-patch';
import 'zone.js/dist/async-test';
import 'zone.js/dist/fake-async-test';

// Fetch should be available in the browser.
// This is here just to shim it in PhantomJS or browsers that do not have it.
import 'whatwg-fetch/fetch';

import {TestBed} from '@angular/core/testing';
import {BrowserDynamicTestingModule, platformBrowserDynamicTesting} from '@angular/platform-browser-dynamic/testing';

TestBed.initTestEnvironment(
	BrowserDynamicTestingModule,
	platformBrowserDynamicTesting()
);
