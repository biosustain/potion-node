/* tslint:disable:max-file-line-count */
// Dependency of Angular 2
import 'zone.js';
// Angular 2 testing `async` needs this
import 'zone.js/dist/async-test.js';

import {TestBed, async, inject} from '@angular/core/testing';
import {BrowserDynamicTestingModule, platformBrowserDynamicTesting} from '@angular/platform-browser-dynamic/testing';

import {MockBackend, MockConnection} from '@angular/http/testing';

import {Observable} from 'rxjs/Observable';
import {Subscription} from 'rxjs/Subscription';
// RxJs Statics
import 'rxjs/add/observable/of';

import {RequestMethod, ResponseOptions, Response} from '@angular/http';

import {PotionTestingModule} from './testing/potion_testing_module';
import {Item, Route} from '../core';
import {
	POTION_RESOURCES,
	POTION_CONFIG,
	POTION_HTTP,
	Potion
} from './potion';


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

		it('should provide a Potion instance', inject([Potion], (potion: Potion) => {
			expect(potion).not.toBeUndefined();
			expect(potion instanceof Potion).toBe(true);
		}));

		it('should register any passed resources', inject([Potion], (potion: Potion) => {
			expect(potion).not.toBeUndefined();
			expect(potion.resources.hasOwnProperty('/user')).toBeTruthy();
		}));

		it('should allow Potion().request() to use Http', async(inject([MockBackend], (backend: MockBackend) => {
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

		it('should configure Potion({host, prefix, cache}) properties', inject([Potion], (potion: Potion) => {
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

		it('should change the underlying Potion() Http engine', async(inject([Potion], (potion: Potion) => {
			potion.fetch('/ping').then((res) => {
				expect(res).toEqual(body);
			});
		})));
	});

	describe('Potion()', () => {
		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [PotionTestingModule]
			});
		});

		afterEach(() => inject([MockBackend], (backend: MockBackend) => {
			backend.verifyNoPendingRequests();
		}));

		describe('.request()', () => {
			it('should return a Promise', inject([Potion], (potion: Potion) => {
				expect(potion.fetch('/ping') instanceof Promise).toBe(true);
			}));

			it('should make a XHR request', async(inject([MockBackend, Potion], (backend: MockBackend, potion: Potion) => {
				const subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => connection.mockRespond(
					new Response(
						new ResponseOptions({status: 200})
					)
				));
				potion.fetch('/ping').then(() => {
					subscription.unsubscribe();
				});
			})));

			it('should return a Promise with data', async(inject([MockBackend, Potion], (backend: MockBackend, potion: Potion) => {
				const subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => connection.mockRespond(
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

			it('should use the appropriate request method set by the {method} option', async(inject([MockBackend, Potion], (backend: MockBackend, potion: Potion) => {
				let method: RequestMethod | null = null;
				const subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => {
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

			it('should pass anything set on {data} option as the {body} property of the request in JSON format', async(inject([MockBackend, Potion], (backend: MockBackend, potion: Potion) => {
				let body = '';
				const subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => {
					body = connection.request.text();
					connection.mockRespond(new Response(
						new ResponseOptions({status: 200})
					));
				});

				potion.fetch('/ping', {method: 'GET', data: {pong: true}}).then(() => {
					expect(body.length).not.toBe(0);
					expect(JSON.parse(body)).toEqual({pong: true});
					subscription.unsubscribe();
				});
			})));

			it('should pass on the query params from the {search} option', async(inject([MockBackend, Potion], (backend: MockBackend, potion: Potion) => {
				let url: string | null = null;
				const subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => {
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
			backend.verifyNoPendingRequests();
		}));

		describe('.fetch()', () => {
			it('should use a memory cache by default to store and retrieve items', async(inject([MockBackend, Potion], (backend: MockBackend, potion: Potion) => {
				@potion.registerAs('/user')
				class User extends Item {}

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

	describe('Route', () => {
		class User extends Item {
			static names: any = Route.GET<string[]>('/names');
		}

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

		afterEach(() => inject([MockBackend], (backend: MockBackend) => {
			backend.verifyNoPendingRequests();
		}));

		describe('.GET()', () => {
			it('should return valid JSON', async(inject([MockBackend], (backend: MockBackend) => {
				const body = [
					'John Doe',
					'Jane Doe'
				];
				const subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => connection.mockRespond(
					new Response(
						new ResponseOptions({
							status: 200,
							body
						})
					)
				));

				User.names().then((names: any) => {
					expect(names instanceof Array).toBe(true);
					expect(names).toEqual(body);
					subscription.unsubscribe();
				});
			})));
		});
	});
});
