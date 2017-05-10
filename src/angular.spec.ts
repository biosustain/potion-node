/* tslint:disable: no-magic-numbers max-classes-per-file */

import * as angular from 'angular';
import 'angular-mocks';
import {Item} from './angular';


describe('potion/angular', () => {
	describe('potionProvider', () => {
		let $cacheFactory;
		let $q;
		let $http;

		let provider;

		beforeEach(angular.mock.module('test', ['potionProvider', potionProvider => {
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
				const config = {prefix: '/api'};
				provider.config(config);
				expect(provider.config()).toEqual(config);
				expect(provider.$get[provider.$get.length - 1]($cacheFactory, $q, $http).prefix).toEqual('/api');
			});
		});
	});

	describe('Potion()', () => {
		describe('.fetch()', () => {
			let $httpBackend;
			let $q;
			let potion;

			beforeEach(angular.mock.module('test'));

			beforeEach(angular.mock.inject(($injector: any): any => {
				$httpBackend = $injector.get('$httpBackend');
				$q = $injector.get('$q');
				potion = $injector.get('potion');
			}));

			afterEach(() => {
				$httpBackend.verifyNoOutstandingRequest();
			});

			it('should make a XHR request', () => {
				const response = jasmine.createSpy('response').and.returnValue([200, {}]);
				$httpBackend.expect('GET', '/ping').respond(response);

				potion.fetch('/ping');

				$httpBackend.flush();

				expect(response).toHaveBeenCalled();
			});

			it('should use the appropriate request method set by the {method} option', () => {
				const response = jasmine.createSpy('response').and.returnValue([200, {}]);
				$httpBackend.expect('PATCH', '/ping').respond(response);

				potion.fetch('/ping', {method: 'PATCH'});

				$httpBackend.flush();

				expect(response).toHaveBeenCalled();
			});

			it('should pass anything set on {data} option as the {body} property of the request in JSON format', () => {
				let body = '';
				const response = jasmine.createSpy('response');
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
				const response = jasmine.createSpy('response');
				$httpBackend.expect('GET', '/ping?pong=true').respond((...args) => {
					search = args[4];
					response();
					return [200, {}];
				});

				potion.fetch('/ping', {method: 'GET', search: {pong: true}});

				$httpBackend.flush();

				expect(response).toHaveBeenCalled();
				expect(search).not.toBeNull();
				expect<any>(search).toEqual({pong: 'true'});
			});

			it('should return a Promise', () => {
				$httpBackend.expect('GET', '/ping').respond(200);
				expect(potion.fetch('/ping') instanceof $q).toBe(true);
				$httpBackend.flush();
			});

			it('should return a Promise with data', () => {
				$httpBackend.expect('GET', '/ping').respond(200, {pong: true});

				const spy = jasmine.createSpy('potion.fetch()');
				potion.fetch('/ping').then(data => {
					expect(data).not.toBeUndefined();
					expect(data).toEqual({pong: true});
					spy();
				});

				$httpBackend.flush();
				expect(spy).toHaveBeenCalled();
			});
		});
	});

	describe('Item()', () => {
		describe('.fetch()', () => {
			let $cacheFactory;
			let $httpBackend;
			let User; /* tslint:disable-line: variable-name */

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
				const cache = $cacheFactory.get('potion');
				expect(cache).not.toBeUndefined();

				const response = jasmine.createSpy('response').and.returnValue([200, {$uri: '/user/1'}]);
				$httpBackend.expect('GET', '/user/1').respond(response);

				const spy = jasmine.createSpy('User.fetch()');
				User.fetch(1).then(() => {
					expect(cache.get('/user/1')).not.toBeUndefined();
					User.fetch(1).then((user: User) => {
						expect(response).toHaveBeenCalledTimes(1);
						expect(user).not.toBeUndefined();
					});
					spy();
				});

				$httpBackend.flush();
				expect(spy).toHaveBeenCalled();
			});

			it('should work with cross references', () => {
				$httpBackend.expect('GET', '/user/1').respond(200, {$uri: '/user/1', sibling: {$ref: '/user/2'}});
				$httpBackend.expect('GET', '/user/2').respond(200, {$uri: '/user/2', sibling: {$ref: '/user/1'}});

				const spy = jasmine.createSpy('User.fetch()');
				User.fetch(1).then((user: User) => {
					expect(user instanceof User).toBe(true);
					expect(user.sibling instanceof User).toBe(true);
					spy();
				});

				$httpBackend.flush();
				expect(spy).toHaveBeenCalled();
			});
		});
	});

	describe('Item.query()', () => {
		let $httpBackend;
		let User; /* tslint:disable-line: variable-name */
		let Group; /* tslint:disable-line: variable-name */

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

			const spy = jasmine.createSpy('User.query()');
			User.query().then((users: User[]) => {
				expect(users.length).toEqual(2);
				for (const user of users) {
					expect(user.groups.length).toEqual(2);
					for (const group of user.groups) {
						expect(group instanceof Group).toBe(true);
						expect(group.members.length).toEqual(2);
						for (const member of group.members) {
							expect(member instanceof User).toBe(true);
						}
					}
				}
				spy();
			});

			$httpBackend.flush();
			expect(spy).toHaveBeenCalled();
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
	.config(['potionProvider', potionProvider => {
		potionProvider.config({prefix: ''});
	}])
	.factory('User', ['potion', potion => potion.register('/user', User)])
	.factory('Group', ['potion', potion => potion.register('/group', Group)]);
