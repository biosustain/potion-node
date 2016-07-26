import {addProviders, setBaseTestProviders, inject} from '@angular/core/testing';
import {TEST_BROWSER_PLATFORM_PROVIDERS, TEST_BROWSER_APPLICATION_PROVIDERS} from '@angular/platform-browser/testing';
import {
	MockBackend,
	MockConnection
} from '@angular/http/testing';


import {Observable} from 'rxjs/Observable';
import {Subscription} from 'rxjs/Subscription';


import {
	ConnectionBackend,
	RequestMethod,
	BaseRequestOptions,
	ResponseOptions,
	Response,
	Http
} from '@angular/http';


// Prepare for tests
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
	describe('POTION_PROVIDERS', () => {
		beforeEach(() => {
			addProviders([
				POTION_PROVIDERS,
				{
					provide: Http,
					useFactory: (connectionBackend: ConnectionBackend, defaultOptions: BaseRequestOptions) => {
						return new Http(connectionBackend, defaultOptions);
					},
					deps: [
						MockBackend,
						BaseRequestOptions
					]
				},
				BaseRequestOptions,
				MockBackend
			]);
		});

		it('should provide a Potion instance', inject([Potion], (potion: Potion) => {
			expect(potion).not.toBeUndefined();
			expect(potion instanceof Potion).toBe(true);
		}));
	});

	describe('POTION_CONFIG', () => {
		beforeEach(() => {
			addProviders([
				POTION_PROVIDERS,
				{
					provide: POTION_CONFIG,
					useValue: {
						prefix: '/test'
					}
				},
				{
					provide: Http,
					useFactory: (connectionBackend: ConnectionBackend, defaultOptions: BaseRequestOptions) => {
						return new Http(connectionBackend, defaultOptions);
					},
					deps: [
						MockBackend,
						BaseRequestOptions
					]
				},
				BaseRequestOptions,
				MockBackend
			]);
		});

		it('should configure Potion({prefix, cache}) properties', inject([Potion], (potion: Potion) => {
			expect(potion.prefix).toEqual('/test');
		}));
	});

	describe('Potion()', () => {
		let potion: Potion;
		let backend: MockBackend;
		let response: Response;

		beforeEach(() => {
			addProviders([
				POTION_PROVIDERS,
				{
					provide: Http,
					useFactory: (connectionBackend: ConnectionBackend, defaultOptions: BaseRequestOptions) => {
						return new Http(connectionBackend, defaultOptions);
					},
					deps: [
						MockBackend,
						BaseRequestOptions
					]
				},
				BaseRequestOptions,
				MockBackend
			]);
		});

		beforeEach(inject([MockBackend, Potion], (mb: MockBackend, p: Potion) => {
			backend = mb;
			potion = p;
		}));

		beforeEach(() => {
			response = new Response(
				new ResponseOptions({status: 200})
			);
		});

		afterEach(() => backend.verifyNoPendingRequests());

		describe('.request()', () => {
			it('should return a Promise', () => {
				expect(potion.fetch('/ping') instanceof Promise).toBe(true);
			});

			it('should make a XHR request', (done: () => void) => {
				let subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => connection.mockRespond(response));
				potion.fetch('/ping').then(() => {
					subscription.unsubscribe();
					done();
				});
			});

			it('should return a Promise with data', (done: () => void) => {
				let subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => {
					connection.mockRespond(new Response(
						new ResponseOptions({
							status: 200,
							body: {
								pong: true
							}
						})
					));
				});
				potion.fetch('/ping').then((data) => {
					expect(data).not.toBeUndefined();
					expect(data).toEqual({pong: true});
					subscription.unsubscribe();
					done();
				});
			});

			it('should use the appropriate request method set by the {method} option', (done: () => void) => {
				let method = null;
				let subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => {
					method = connection.request.method;
					connection.mockRespond(response);
				});

				potion.fetch('/ping', {method: 'PATCH'}).then(() => {
					expect(method).toEqual(RequestMethod.Patch);
					subscription.unsubscribe();
					done();
				});
			});

			it('should pass anything set on {data} option as the {body} property of the request in JSON format', (done: () => void) => {
				let body = null;
				let subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => {
					body = connection.request.text();
					connection.mockRespond(response);
				});

				potion.fetch('/ping', {method: 'GET', data: {pong: true}}).then(() => {
					expect(body).not.toBeNull();
					expect(JSON.parse(body)).toEqual({pong: true});
					subscription.unsubscribe();
					done();
				});
			});

			it('should pass on the query params from the {search} option', (done: () => void) => {
				let url = null;
				let subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => {
					url = connection.request.url;
					connection.mockRespond(response);
				});

				potion.fetch('/ping', {method: 'POST', search: {pong: true}}).then(() => {
					expect(url).not.toBeNull();
					expect(url).toEqual('/ping?pong=true');
					subscription.unsubscribe();
					done();
				});
			});
		});
	});

	describe('Item()', () => {
		let potion: Potion;
		let backend: MockBackend;

		beforeEach(() => {
			addProviders([
				POTION_PROVIDERS,
				{
					provide: Http,
					useFactory: (connectionBackend: ConnectionBackend, defaultOptions: BaseRequestOptions) => {
						return new Http(connectionBackend, defaultOptions);
					},
					deps: [
						MockBackend,
						BaseRequestOptions
					]
				},
				BaseRequestOptions,
				MockBackend
			]);
		});

		beforeEach(inject([MockBackend, Potion], (mb: MockBackend, p: Potion) => {
			backend = mb;
			potion = p;
		}));

		afterEach(() => backend.verifyNoPendingRequests());

		describe('.fetch()', () => {
			it('should use a memory cache by default to store and retrieve items', (done) => {
				@potion.registerAs('/user')
				class User extends Item {}

				let subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => {
					connection.mockRespond(new Response(
						new ResponseOptions({
							status: 200,
							body: {
								$uri: '/user/1'
							}
						})
					));
				});

				User.fetch(1).then(() => {
					expect(User.store.cache.get('/user/1')).not.toBeUndefined();
					User.fetch(1).then((user: User) => {
						expect(user).not.toBeUndefined();
						subscription.unsubscribe();
						done();
					});
				});
			});
		});
	});
});


class User extends Item {}
