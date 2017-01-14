import * as angular from 'angular';
import 'angular-mocks';
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

		beforeEach(angular.mock.inject(($injector: any): any => {
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

			beforeEach(angular.mock.inject(($injector: any): any => {
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
				let body = '';
				let response = jasmine.createSpy('response');
				$httpBackend.expect('POST', '/ping').respond((...args) => {
					body = args[2];
					response();
					return [200, {}];
				});

				potion.fetch('/ping', {method: 'POST', data: {pong: true}});

				$httpBackend.flush();

				expect(response).toHaveBeenCalled();
				expect(body.length).not.toBe(0);
				expect(JSON.parse(body)).toEqual({pong: true});
			});

			it('should pass on the query params from the {search} option', () => {
				let search = null;
				let response = jasmine.createSpy('response');
				$httpBackend.expect('GET', '/ping?pong=true').respond((...args) => {
					search = args[4];
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
				$httpBackend.flush();
			});

			it('should return a Promise with data', () => {
				$httpBackend.expect('GET', '/ping').respond(200, {pong: true});

				potion.fetch('/ping').then((data) => {
					expect(data).not.toBeUndefined();
					expect(data).toEqual({pong: true});
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

			beforeEach(angular.mock.inject(($injector: any): any => {
				$cacheFactory = $injector.get('$cacheFactory');
				$httpBackend = $injector.get('$httpBackend');

				User = $injector.get('User');
			}));

			afterEach(() => {
				$httpBackend.verifyNoOutstandingRequest();
			});

			it('should use $cacheFactory by default to to store and retrieve items', () => {
				let cache = $cacheFactory.get('potion');

				expect(cache).not.toBeUndefined();

				let response = jasmine.createSpy('response').and.returnValue([200, {$uri: '/user/1'}]);
				$httpBackend.expect('GET', '/user/1').respond(response);

				User.fetch(1).then(() => {
					expect(cache.get('/user/1')).not.toBeUndefined();
					User.fetch(1).then((user: User) => {
						expect(response).toHaveBeenCalledTimes(1);
						expect(user).not.toBeUndefined();
					});
				});

				$httpBackend.flush();
			});

			it('should work with cross references', () => {
				$httpBackend.expect('GET', '/user/1').respond(200, {$uri: '/user/1', sibling: {$ref: '/user/2'}});
				$httpBackend.expect('GET', '/user/2').respond(200, {$uri: '/user/2', sibling: {$ref: '/user/1'}});

				User.fetch(1).then((user: User) => {
					expect(user instanceof User).toBe(true);
					expect(user.sibling instanceof User).toBe(true);
				});

				$httpBackend.flush();
			});
		});
	});

	describe('Item.query()', () => {
		let $httpBackend;

		// Make sure tslint does not complain about the var names
		/* tslint:disable: variable-name */
		let User;
		let Group;
		/* tslint:enable: variable-name */

		beforeEach(angular.mock.module('test'));

		beforeEach(angular.mock.inject(($injector: any): any => {
			$httpBackend = $injector.get('$httpBackend');

			User = $injector.get('User');
			Group = $injector.get('Group');
		}));

		afterEach(() => {
			$httpBackend.verifyNoOutstandingRequest();
		});

		it('should work with cross references', () => {
			$httpBackend.when('GET', '/user').respond(200, [{$ref: '/user/1'}, {$ref: '/user/2'}]);
			$httpBackend.when('GET', '/group').respond(200, [{$ref: '/group/1'}, {$ref: '/group/2'}]);


			$httpBackend.when('GET', '/user/1').respond(200, {
				$uri: '/user/1',
				// sibling: {$ref: '/user/2'},
				groups: [
					{$ref: '/group/1'},
					{$ref: '/group/2'}
				]
			});

			$httpBackend.when('GET', '/user/2').respond(200, {
				$uri: '/user/2',
				// sibling: {$ref: '/user/1'},
				groups: [
					{$ref: '/group/1'},
					{$ref: '/group/2'}
				]
			});


			$httpBackend.when('GET', '/group/1').respond(200, {
				$uri: '/group/1',
				members: [
					{$ref: '/user/1'},
					{$ref: '/user/2'}
				]
			});

			$httpBackend.when('GET', '/group/2').respond(200, {
				$uri: '/group/2',
				members: [
					{$ref: '/user/1'},
					{$ref: '/user/2'}
				]
			});

			User.query().then((users: User[]) => {
				expect(users.length).toEqual(2);
				for (let user of users) {
					expect(user.groups.length).toEqual(2);
					for (let group of user.groups) {
						expect(group instanceof Group).toBe(true);
						expect(group.members.length).toEqual(2);
						for (let member of group.members) {
							expect(member instanceof User).toBe(true);
						}
					}
				}
			});

			$httpBackend.flush();
		});
	});
});


// Resources
class User extends Item {
	name: string;
	sibling: User;
	groups: Group[];
}

class Group extends Item {
	members: User[];
}

// Configure Potion,
// and register resources
angular
	.module('test', ['potion'])
	.config(['potionProvider', (potionProvider) => {
		potionProvider.config({prefix: ''});
	}])
	.factory('User', ['potion', (potion) => {
		return potion.register('/user', User);
	}])
	.factory('Group', ['potion', (potion) => {
		return potion.register('/group', Group);
	}]);
