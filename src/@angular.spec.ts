// `async` needs this
import 'zone.js/dist/async-test.js';

import {
	async,
	addProviders,
	setBaseTestProviders,
	inject
} from '@angular/core/testing';
import {TEST_BROWSER_PLATFORM_PROVIDERS, TEST_BROWSER_APPLICATION_PROVIDERS} from '@angular/platform-browser/testing';
import {
	MockBackend,
	MockConnection
} from '@angular/http/testing';


import {Observable} from 'rxjs/Observable';
import {Subscription} from 'rxjs/Subscription';
// RxJs Statics
import 'rxjs/add/observable/of';


import {
	ExceptionHandler,
	ComponentRef,
	Component,
	disposePlatform
} from '@angular/core';
// TODO: the next two lines are not ideal, we should avoid importing from private locations
import {Console} from '@angular/core/src/console';
import {getDOM} from '@angular/platform-browser/src/dom/dom_adapter';
import {DOCUMENT} from '@angular/platform-browser';
import {bootstrap} from '@angular/platform-browser-dynamic';


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
	POTION_HTTP,
	POTION_PROVIDERS,
	Potion,
	Item,
	providePotion
} from './@angular';


describe('potion/@angular', () => {
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

	describe('providePotion()', () => {
		let bindings;

		class User extends Item {}

		beforeEach(() => {
			disposePlatform();
		});

		beforeEach(() => {
			const fakeDoc = getDOM().createHtmlDocument();
			const el = getDOM().createElement('potion-test', fakeDoc);
			getDOM().appendChild(fakeDoc.body, el);

			const logger = new ArrayLogger();
			const exceptionHandler = new ExceptionHandler(logger, false);

			bindings = [
				{provide: DOCUMENT, useValue: fakeDoc},
				{provide: ExceptionHandler, useValue: exceptionHandler},
				{
					provide: Console,
					useClass: DummyConsole
				},
				providePotion({
					'/user': User
				}),
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
			];
		});

		afterEach(() => {
			disposePlatform();
		});

		it('should register any passed resources', async(() => {
			bootstrap(PotionTestComponent, bindings).then((applicationRef: ComponentRef<PotionTestComponent>) => {
				const {injector} = applicationRef;
				const potion = injector.get(Potion);
				expect(potion).not.toBeUndefined();
				expect(potion.resources.hasOwnProperty('/user')).toBeTruthy();
			});
		}));

		it('should allow Potion().request() to use Http', async(() => {
			bootstrap(PotionTestComponent, bindings).then((applicationRef: ComponentRef<PotionTestComponent>) => {
				const {injector} = applicationRef;
				const backend = injector.get(MockBackend);
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
			});
		}));
	});

	describe('POTION_CONFIG', () => {
		const POTION_HOST = 'https://localhost';
		const POTION_PREFIX = '/test';

		beforeEach(() => {
			addProviders([
				providePotion({}),
				{
					provide: POTION_CONFIG,
					useValue: {
						host: POTION_HOST,
						prefix: POTION_PREFIX
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
			addProviders([
				providePotion({}),
				{
					provide: POTION_HTTP,
					useClass: Http
				}
			]);
		});

		it('should change the underlying Potion() Http engine', inject([Potion], (potion: Potion) => {
			potion.fetch('/ping').then((res) => {
				expect(res).toEqual(body);
			});
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


// Mock Console
class DummyConsole implements Console {
	log(message: any): void {}
	warn(message: any): void {}
}


// Mock component
@Component({
	selector: 'potion-test',
	template: `<div>Hello</div>`
})
class PotionTestComponent {}


// Mock exception handler logger
class ArrayLogger {
	res: any[] = [];
	logGroup(s: any): void {
		this.res.push(s);
	}
	logGroupEnd(): void {};
	logError(s: any): void {
		this.res.push(s);
	}
	log(s: any): void {
		this.res.push(s);
	}
}
