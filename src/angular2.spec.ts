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
	Item,
	Route
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

	describe('Item.fetch()', () => {
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

		it('should correctly deserialize Potion server response', (done: () => void) => {
			backend.connections.subscribe((connection: MockConnection) => {
				connection.mockRespond(new Response(
					new ResponseOptions({body: JOHN, status: 200})
				));
			});

			User.fetch(1).then((user: User) => {
				expect(user.id).toEqual(1);
				expect(user.name).toEqual(JOHN.name);
				expect(user.createdAt instanceof Date).toBe(true);
				done();
			});
		});

		it('should have a instance route that returns valid JSON', (done) => {
			backend.connections.subscribe((connection: MockConnection) => {
				switch (connection.request.url) {
					case '/api/user/1':
						connection.mockRespond(new Response(
							new ResponseOptions({body: JOHN, status: 200})
						));
						break;
					case '/api/user/1/attributes':
						connection.mockRespond(new Response(
							new ResponseOptions({
								status: 200,
								body: {
									height: 168,
									weight: 72
								}
							})
						));
						break;
					default:
						break;
				}
			});

			User.fetch(1).then((user: User) => {
				console.log(user);
				user.attributes().then((attrs) => {
					expect(attrs.height).toEqual(168);
					expect(attrs.weight).toEqual(72);
					done();
				});
			});
		});

		it('should have a static route that returns valid JSON', (done) => {
			backend.connections.subscribe((connection: MockConnection) => {
				connection.mockRespond(new Response(
					new ResponseOptions({body: [JOHN.name, JANE.name], status: 200})
				));
			});

			User.names().then((names) => {
				expect(Array.isArray(names)).toBe(true);
				expect(names[0]).toEqual(JOHN.name);
				done();
			});
		});
	});
});


// Potion resources
class Ping extends Item {}

class User extends Item {
	static names = Route.GET<string[]>('/names');

	attributes = Route.GET<{height: number, weight: number}>('/attributes');
	name: string;
	createdAt: Date;
}

// Mock users
const JOHN = {
	$uri: '/user/1',
	name: 'John Doe',
	created_at: {
		$date: 1451060269000
	}
};

const JANE = {
	$uri: '/user/2',
	name: 'Jone Doe',
	created_at: {
		$date: 1451060269000
	}
};
