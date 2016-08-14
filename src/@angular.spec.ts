// `async` needs this
import 'zone.js/dist/async-test.js';

import {TestBed, async, inject} from '@angular/core/testing';
import {BrowserDynamicTestingModule, platformBrowserDynamicTesting} from '@angular/platform-browser-dynamic/testing';

import {MockBackend, MockConnection} from '@angular/http/testing';

import {Observable} from 'rxjs/Observable';
import {Subscription} from 'rxjs/Subscription';
// RxJs Statics
import 'rxjs/add/observable/of';

import {RequestMethod, ResponseOptions, Response} from '@angular/http';

import {
	POTION_RESOURCES,
	POTION_CONFIG,
	POTION_HTTP,
	PotionProvider,
	Item,
	PotionTestingModule
} from './@angular';


// Prepare for tests
TestBed.initTestEnvironment(
	BrowserDynamicTestingModule,
	platformBrowserDynamicTesting()
);


describe('potion/@angular', () => {
	describe('PotionModule', () => {
		class User extends Item {}

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [PotionTestingModule],
				providers: [
					{
						provide: POTION_RESOURCES,
						useValue: {
							'/user': User
						},
						multi: true
					}
				]
			});
		});

		it('should provide a PotionProvider instance', inject([PotionProvider], (potion: PotionProvider) => {
			expect(potion).not.toBeUndefined();
			expect(potion instanceof PotionProvider).toBe(true);
		}));

		it('should register any passed resources', inject([PotionProvider], (potion: PotionProvider) => {
			expect(potion).not.toBeUndefined();
			expect(potion.resources.hasOwnProperty('/user')).toBeTruthy();
		}));

		it('should allow PotionProvider().request() to use Http', async(inject([MockBackend], (backend: MockBackend) => {
			const subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => connection.mockRespond(
				new Response(
					new ResponseOptions({
						status: 200,
						body: {
							$uri: '/user/1'
						}
					})
				)
			));

			User.fetch(1).then((user) => {
				subscription.unsubscribe();
				expect(user).not.toBeUndefined();
				expect(user.id).toEqual(1);
			});
		})));
	});

	describe('POTION_CONFIG', () => {
		const POTION_HOST = 'https://localhost';
		const POTION_PREFIX = '/test';

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [PotionTestingModule],
				providers: [
					{
						provide: POTION_CONFIG,
						useValue: {
							host: POTION_HOST,
							prefix: POTION_PREFIX
						}
					}
				]
			});
		});

		it('should configure PotionProvider({host, prefix, cache}) properties', inject([PotionProvider], (potion: PotionProvider) => {
			expect(potion.host).toEqual(POTION_HOST);
			expect(potion.prefix).toEqual(POTION_PREFIX);
		}));
	});

	describe('POTION_HTTP', () => {
		const body =  {
			pong: true
		};
		class Http {
			request(): Observable<any> {
				return Observable.of(new Response(
					new ResponseOptions({
						status: 200,
						body
					})
				));
			}
		}

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [PotionTestingModule],
				providers: [
					{
						provide: POTION_HTTP,
						useClass: Http
					}
				]
			});
		});

		it('should change the underlying PotionProvider() Http engine', async(inject([PotionProvider], (potion: PotionProvider) => {
			potion.fetch('/ping').then((res) => {
				expect(res).toEqual(body);
			});
		})));
	});

	describe('PotionProvider()', () => {
		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [PotionTestingModule]
			});
		});

		afterEach(() => inject([MockBackend], (backend: MockBackend) => {
			backend.verifyNoPendingRequests()
		}));

		describe('.request()', () => {
			it('should return a Promise', inject([PotionProvider], (potion: PotionProvider) => {
				expect(potion.fetch('/ping') instanceof Promise).toBe(true);
			}));

			it('should make a XHR request', async(inject([MockBackend, PotionProvider], (backend: MockBackend, potion: PotionProvider) => {
				let subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => connection.mockRespond(
					new Response(
						new ResponseOptions({status: 200})
					)
				));
				potion.fetch('/ping').then(() => {
					subscription.unsubscribe();
				});
			})));

			it('should return a Promise with data', async(inject([MockBackend, PotionProvider], (backend: MockBackend, potion: PotionProvider) => {
				let subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => connection.mockRespond(
					new Response(
						new ResponseOptions({
							status: 200,
							body: {
								pong: true
							}
						})
					)
				));
				potion.fetch('/ping').then((data) => {
					expect(data).not.toBeUndefined();
					expect(data).toEqual({pong: true});
					subscription.unsubscribe();
				});
			})));

			it('should use the appropriate request method set by the {method} option', async(inject([MockBackend, PotionProvider], (backend: MockBackend, potion: PotionProvider) => {
				let method = null;
				let subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => {
					method = connection.request.method;
					connection.mockRespond(new Response(
						new ResponseOptions({status: 200})
					));
				});

				potion.fetch('/ping', {method: 'PATCH'}).then(() => {
					expect(method).toEqual(RequestMethod.Patch);
					subscription.unsubscribe();
				});
			})));

			it('should pass anything set on {data} option as the {body} property of the request in JSON format', async(inject([MockBackend, PotionProvider], (backend: MockBackend, potion: PotionProvider) => {
				let body = null;
				let subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => {
					body = connection.request.text();
					connection.mockRespond(new Response(
						new ResponseOptions({status: 200})
					));
				});

				potion.fetch('/ping', {method: 'GET', data: {pong: true}}).then(() => {
					expect(body).not.toBeNull();
					expect(JSON.parse(body)).toEqual({pong: true});
					subscription.unsubscribe();
				});
			})));

			it('should pass on the query params from the {search} option', async(inject([MockBackend, PotionProvider], (backend: MockBackend, potion: PotionProvider) => {
				let url = null;
				let subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => {
					url = connection.request.url;
					connection.mockRespond(new Response(
						new ResponseOptions({status: 200})
					));
				});

				potion.fetch('/ping', {method: 'POST', search: {pong: true}}).then(() => {
					expect(url).not.toBeNull();
					expect(url).toEqual('/ping?pong=true');
					subscription.unsubscribe();
				});
			})));
		});
	});

	describe('Item()', () => {
		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [PotionTestingModule]
			});
		});

		afterEach(() => inject([MockBackend], (backend: MockBackend) => {
			backend.verifyNoPendingRequests()
		}));

		describe('.fetch()', () => {
			it('should use a memory cache by default to store and retrieve items', async(inject([MockBackend, PotionProvider], (backend: MockBackend, potion: PotionProvider) => {
				@potion.registerAs('/user')
				class User extends Item {}

				let subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => connection.mockRespond(
					new Response(
						new ResponseOptions({
							status: 200,
							body: {
								$uri: '/user/1'
							}
						})
					)
				));

				User.fetch(1).then(() => {
					expect(User.store.cache.get('/user/1')).not.toBeUndefined();
					User.fetch(1).then((user: User) => {
						expect(user).not.toBeUndefined();
						subscription.unsubscribe();
					});
				});
			})));
		});
	});
});
