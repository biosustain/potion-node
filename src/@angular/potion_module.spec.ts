/* tslint:disable:max-file-line-count max-classes-per-file no-magic-numbers */
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

			it('should not fail when requests respond empty body', async(inject([MockBackend, Potion], (backend: MockBackend, potion: Potion) => {
				const subscription: Subscription = (backend.connections as Observable<any>).subscribe((connection: MockConnection) => {
					connection.mockRespond(new Response(
						new ResponseOptions({status: 204, body: ''})
					));
				});

				potion.fetch('/ping', {method: 'DELETE'}).then((response) => {
					expect(response).toBeNull();
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

		describe('.query()', () => {
			it('should work with back references', async(inject([MockBackend, Potion], (backend: MockBackend, potion: Potion) => {
				// Back references mock classes
				@potion.registerAs('/m1')
				class M1 extends Item {
					m2: M2;
				}
				@potion.registerAs('/m2')
				class M2 extends Item {
					m3: M3;
					m1s: M1[];
				}
				@potion.registerAs('/m3')
				class M3 extends Item {
					m4: M4;
					m2s: M2[];
				}
				@potion.registerAs('/m4')
				class M4 extends Item {
					m3s: M3[];
				}

				const subscription: Subscription = backend.connections.subscribe((connection: MockConnection) => {
					const {request} = connection;
					const {url} = request;
					let response;

					switch (url) {
						// Circular dependency mock data
						case '/m1':
							response = new Response(new ResponseOptions({status: 200, body: [{$ref: '/m1/1'}, {$ref: '/m1/2'}, {$ref: '/m1/3'}]}));
							break;
						case '/m1/1':
							response = new Response(new ResponseOptions({status: 200, body: {$uri: '/m1/1', m2: {$ref: '/m2/1'}}}));
							break;
						case '/m1/2':
							response = new Response(new ResponseOptions({status: 200, body: {$uri: '/m1/2', m2: {$ref: '/m2/1'}}}));
							break;
						case '/m1/3':
							response = new Response(new ResponseOptions({status: 200, body: {$uri: '/m1/3', m2: {$ref: '/m2/2'}}}));
							break;
						case '/m2/1':
							response = new Response(new ResponseOptions({status: 200, body: {$uri: '/m2/1', m1s: [{$ref: '/m1/1'}, {$ref: '/m1/2'}], m3: {$ref: '/m3/1'}}}));
							break;
						case '/m2/2':
							response = new Response(new ResponseOptions({status: 200, body: {$uri: '/m2/2', m1s: [{$ref: '/m1/3'}], m3: {$ref: '/m3/1'}}}));
							break;
						case '/m2/3':
							response = new Response(new ResponseOptions({status: 200, body: {$uri: '/m2/3', m1s: [], m3: {$ref: '/m3/2'}}}));
							break;
						case '/m3/1':
							response = new Response(new ResponseOptions({status: 200, body: {$uri: '/m3/1', m2s: [{$ref: '/m2/1'}, {$ref: '/m2/2'}], m4: {$ref: '/m4/1'}}}));
							break;
						case '/m3/2':
							response = new Response(new ResponseOptions({status: 200, body: {$uri: '/m3/2', m2s: [{$ref: '/m2/3'}], m4: {$ref: '/m4/1'}}}));
							break;
						case '/m4/1':
							response = new Response(new ResponseOptions({status: 200, body: {$uri: '/m4/1', m3s: [{$ref: '/m3/1'}, {$ref: '/m3/2'}]}}));
							break;

						default:
							break;
					}

					if (['/m1/2', '/m2/2', '/m3/1', '/m4/1'].indexOf(url) !== -1) {
						// Simulate latency
						setTimeout(() => {
							connection.mockRespond(response);
						}, 1500);
					} else {
						connection.mockRespond(response);
					}
				});

				M1.query()
					.then((m1s: M1[]) => {
						expect(m1s.length).toEqual(3);
						m1s.forEach((m1) => expect(m1 instanceof M1).toBeTruthy());

						const m4s = m1s.map(({m2}) => m2)
							.map(({m3}) => m3)
							.map(({m4}) => m4);

						m4s.forEach((m4) => expect(m4 instanceof M4).toBeTruthy());

						subscription.unsubscribe();
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
