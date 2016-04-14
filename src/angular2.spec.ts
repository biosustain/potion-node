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
	BaseRequestOptions,
	ResponseOptions,
	Response,
	Http
} from 'angular2/http';


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
		describe('.request()', () => {
			it('should make a XHR request', (done: () => void) => {
				backend.connections.subscribe((connection: MockConnection) => {
					connection.mockRespond(new Response(
						new ResponseOptions({status: 200})
					));
				});

				Ping.fetch(1).then(() => {
					done();
				});
			});
		});
	});
});


// Potion resources
class Ping extends Item {}
class User extends Item {
	name: string;
}
