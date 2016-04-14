import {
	afterEach,
	beforeEach,
	describe,
	expect,
	setBaseTestProviders
} from 'angular2/testing';
import {TEST_BROWSER_PLATFORM_PROVIDERS, TEST_BROWSER_APPLICATION_PROVIDERS} from 'angular2/platform/testing/browser';
import {
	MockBackend,
	MockConnection
} from 'angular2/http/testing';
import {Injector, provide} from 'angular2/core';
import {
	ConnectionBackend,
	RequestMethod,
	BaseRequestOptions,
	ResponseOptions,
	Response,
	Http
} from 'angular2/http';
import {Observable} from 'rxjs/Observable';
import {Subscription} from 'rxjs/Subscription';

setBaseTestProviders(
	TEST_BROWSER_PLATFORM_PROVIDERS,
	TEST_BROWSER_APPLICATION_PROVIDERS
);

import {
	POTION_CONFIG,
	POTION_PROVIDERS,
	Potion,
	Item
} from './angular2';


describe('potion/angular2', () => {
	let injector: Injector;
	let potion: Potion;
	let backend: MockBackend;

	beforeEach(() => {
		injector = Injector.resolveAndCreate([
			BaseRequestOptions,
			MockBackend,
			POTION_PROVIDERS,
			provide(Http, {
				useFactory: (connectionBackend: ConnectionBackend, defaultOptions: BaseRequestOptions) => {
					return new Http(connectionBackend, defaultOptions);
				},
				deps: [
					MockBackend,
					BaseRequestOptions
				]
			}),
			provide(POTION_CONFIG, {
				useValue: {
					prefix: '/api'
				}
			})
		]);
		backend = injector.get(MockBackend);
		potion = injector.get(Potion);

		// Register Potion resources
		potion.register('/ping', Ping);
		potion.register('/user', User);
	});

	afterEach(() => backend.verifyNoPendingRequests());

	describe('POTION_PROVIDERS', () => {
		it('should provide a Potion instance', () => {
			expect(potion).not.toBeUndefined();
		});
	});

	describe('POTION_CONFIG', () => {
		it('should configure Potion({prefix, cache}) properties', () => {
			expect(potion.prefix).toEqual('/api');
		});
	});

	describe('Potion()', () => {
		let response;
		let subscription: Subscription;

		beforeEach(() => {
			response = new Response(
				new ResponseOptions({status: 200, body: {}})
			);
		});

		afterEach(() => {
			subscription.unsubscribe();
		});

		describe('.request()', () => {
			it('should return a Promise', () => {
				subscription = (<Observable<any>>backend.connections).subscribe((connection: MockConnection) => connection.mockRespond(response));
				expect(potion.request('/ping') instanceof Promise).toBe(true);
			});

			it('should make a XHR request', (done: () => void) => {
				subscription = (<Observable<any>>backend.connections).subscribe((connection: MockConnection) => connection.mockRespond(response));
				Ping.fetch(1).then(() => {
					done();
				});
			});

			it('should return a Promise with a {data, headers} object', (done: () => void) => {
				subscription = (<Observable<any>>backend.connections).subscribe((connection: MockConnection) => connection.mockRespond(response));
				potion.request('/ping').then(({data, headers}) => {
					expect(data).not.toBeUndefined();
					expect(headers).not.toBeUndefined();
					done();
				});
			});

			it('should use the appropriate request method set by the {method} option', (done: () => void) => {
				let method = null;
				subscription = (<Observable<any>>backend.connections).subscribe((connection: MockConnection) => {
					method = connection.request.method;
					connection.mockRespond(response);
				});

				potion.request('/ping', {method: 'PATCH'}).then(() => {
					expect(method).toEqual(RequestMethod.Patch);
					done();
				});
			});

			it('should pass anything set on {data} option as the {body} property of the request in JSON format', (done: () => void) => {
				let body = null;
				subscription = (<Observable<any>>backend.connections).subscribe((connection: MockConnection) => {
					body = connection.request.text();
					connection.mockRespond(response);
				});

				potion.request('/ping', {method: 'POST', data: {pong: true}}).then(() => {
					expect(body).not.toBeNull();
					expect(JSON.parse(body)).toEqual({pong: true});
					done();
				});
			});
		});
	});
});


// Potion resources
class Ping extends Item {}
class User extends Item {}
