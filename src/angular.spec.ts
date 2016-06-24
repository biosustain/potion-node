import {Item} from './angular';


describe('potion/angular', () => {
	describe('potionProvider', () => {
		let $cacheFactory;
		let $q;
		let $http;

		let provider;

		beforeEach(angular.mock.module('test', ['potionProvider', (potionProvider) => {
			provider = potionProvider;
		}]));

		beforeEach(angular.mock.inject(function ($injector) {
			$cacheFactory = $injector.get('$cacheFactory');
			$q = $injector.get('$q');
			$http = $injector.get('$http');
		}));

		it('should provide a Potion instance', () => {
			// Note that the `.$get` when using strict DI,
			// is an array with the last element being the fn.
			expect(provider.$get[provider.$get.length - 1]($cacheFactory, $q, $http)).not.toBeUndefined();
		});

		describe('.config()', () => {
			it('should configure Potion({prefix, cache}) properties', () => {
				let config = {prefix: '/api'};
				provider.config(config);
				expect(provider.config()).toEqual(config);
				expect(provider.$get[provider.$get.length - 1]($cacheFactory, $q, $http).prefix).toEqual('/api');
			});
		});
	});

	describe('Potion()', () => {
		describe('.fetch()', () => {
			let $q;
			let $httpBackend;
			let potion;

			beforeEach(angular.mock.module('test'));

			beforeEach(angular.mock.inject(function ($injector) {
				$q = $injector.get('$q');
				$httpBackend = $injector.get('$httpBackend');
				potion = $injector.get('potion');
			}));

			afterEach(() => {
				$httpBackend.verifyNoOutstandingRequest();
			});

			it('should make a XHR request', () => {
				let response = jasmine.createSpy('response').and.returnValue([200, {}]);
				$httpBackend.expect('GET', '/ping').respond(response);

				potion.fetch('/ping');

				$httpBackend.flush();

				expect(response).toHaveBeenCalled();
			});

			it('should use the appropriate request method set by the {method} option', () => {
				let response = jasmine.createSpy('response').and.returnValue([200, {}]);
				$httpBackend.expect('PATCH', '/ping').respond(response);

				potion.fetch('/ping', {method: 'PATCH'});

				$httpBackend.flush();

				expect(response).toHaveBeenCalled();
			});

			it('should pass anything set on {data} option as the {body} property of the request in JSON format', () => {
				let body = null;
				let response = jasmine.createSpy('response');
				$httpBackend.expect('POST', '/ping').respond((method, url, data: any) => {
					body = data;
					response();
					return [200, {}];
				});

				potion.fetch('/ping', {method: 'POST', data: {pong: true}});

				$httpBackend.flush();

				expect(response).toHaveBeenCalled();
				expect(body).not.toBeNull();
				expect(JSON.parse(body)).toEqual({pong: true});
			});

			it('should pass on the query params from the {search} option', () => {
				let search = null;
				let response = jasmine.createSpy('response');
				$httpBackend.expect('GET', '/ping?pong=true').respond((method, url, data, headers, params) => {
					search = params;
					response();
					return [200, {}];
				});

				potion.fetch('/ping', {method: 'GET', search: {pong: true}});

				$httpBackend.flush();

				expect(response).toHaveBeenCalled();
				expect(search).not.toBeNull();
				expect(search).toEqual({pong: 'true'});
			});

			it('should return a Promise', () => {
				$httpBackend.expect('GET', '/ping').respond(200);
				expect(potion.fetch('/ping') instanceof $q).toBe(true);
			});

			it('should return a Promise with data', (done) => {
				$httpBackend.expect('GET', '/ping').respond(200, {pong: true});

				potion.fetch('/ping').then((data) => {
					expect(data).not.toBeUndefined();
					expect(data).toEqual({pong: true});
					done();
				});

				$httpBackend.flush();
			});
		});
	});

	describe('Item()', () => {
		describe('.fetch()', () => {
			let $cacheFactory;
			let $httpBackend;

			// Make sure tslint does not complain about the var names
			/* tslint:disable: variable-name */
			let User;
			/* tslint:enable: variable-name */

			beforeEach(angular.mock.module('test'));

			beforeEach(angular.mock.inject(function ($injector) {
				$cacheFactory = $injector.get('$cacheFactory');
				$httpBackend = $injector.get('$httpBackend');

				User = $injector.get('User');
			}));

			afterEach(() => {
				$httpBackend.verifyNoOutstandingRequest();
			});

			it('should use $cacheFactory by default to to store and retrieve items', (done) => {
				let cache = $cacheFactory.get('potion');

				expect(cache).not.toBeUndefined();

				let response = jasmine.createSpy('response').and.returnValue([200, {$uri: '/user/1'}]);
				$httpBackend.expect('GET', '/user/1').respond(response);

				User.fetch(1).then(() => {
					expect(cache.get('/user/1')).not.toBeUndefined();
					User.fetch(1).then((user: User) => {
						expect(response).toHaveBeenCalledTimes(1);
						expect(user).not.toBeUndefined();
						done();
					});
				});

				$httpBackend.flush();
			});
		});
	});
});


// Resources
class User extends Item {
	name: string;
}

// Configure Potion,
// and register resources
angular
	.module('test', ['potion'])
	.config(['potionProvider', (potionProvider) => {
		potionProvider.config({prefix: ''});
	}])
	.factory('User', ['potion', (potion) => {
		potion.register('/user', User);
		return User;
	}]);
