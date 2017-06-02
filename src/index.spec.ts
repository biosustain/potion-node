/* tslint:disable:max-file-line-count max-classes-per-file no-magic-numbers */
import {async, inject, TestBed} from '@angular/core/testing';

import {
	BaseRequestOptions,
	ConnectionBackend,
	Http,
	Response,
	ResponseOptions
} from '@angular/http';
import {MockBackend, MockConnection} from '@angular/http/testing';

import {Observable} from 'rxjs/Observable';
import {Subscription} from 'rxjs/Subscription';


import {
	Item,
	Potion,
	POTION_PROVIDER,
	POTION_RESOURCES,
	PotionModule,
	Route
} from './index';


export function provideHttpFactory(connectionBackend: ConnectionBackend, defaultOptions: BaseRequestOptions): Http {
	return new Http(connectionBackend, defaultOptions);
}


describe('potion/ng', () => {
	describe('PotionModule', () => {
		class User extends Item {}

		beforeEach(async(() => {
			TestBed.configureTestingModule({
				imports: [PotionModule],
				providers: [
					{
						provide: POTION_RESOURCES,
						useValue: {
							'/user': User
						},
						multi: true
					},
					// Angular Http
					{
						provide: Http,
						useFactory: provideHttpFactory,
						deps: [
							MockBackend,
							BaseRequestOptions
						]
					},
					BaseRequestOptions,
					MockBackend
				]
			});
		}));

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

			User.fetch(1).then(user => {
				subscription.unsubscribe();
				expect(user).not.toBeUndefined();
				expect(user.id).toEqual(1);
			});
		})));
	});

	describe('Route', () => {
		class User extends Item {
			static names: any = Route.GET<string[]>('/names');
		}

		beforeEach(async(() => {
			TestBed.configureTestingModule({
				imports: [PotionModule],
				providers: [
					POTION_PROVIDER,
					{
						provide: POTION_RESOURCES,
						useValue: {
							'/user': User
						},
						multi: true
					},
					// Angular Http
					{
						provide: Http,
						useFactory: provideHttpFactory,
						deps: [
							MockBackend,
							BaseRequestOptions
						]
					},
					BaseRequestOptions,
					MockBackend
				]
			});
		}));

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
