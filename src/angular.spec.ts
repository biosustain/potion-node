import {
	Pagination,
	Item,
	Route
} from './angular';

import {PotionBase} from './base';

import {toPages} from '../test/utils';


describe('potion/angular', () => {
	let $cacheFactory;
	let $q;
	let $httpBackend;
	let $http;
	let provider;

	// Make sure tslint does not complain about the var names
	/* tslint:disable: variable-name */
	let Delayed;
	let Ping;
	let User;
	let Car;
	/* tslint:enable: variable-name */

	beforeEach((<angular.IMockStatic>angular.mock).module('test', ['potionProvider', (potionProvider) => {
		provider = potionProvider;
	}]));

	beforeEach((<angular.IMockStatic>angular.mock).inject(function ($injector) {
		$cacheFactory = $injector.get('$cacheFactory');
		$q = $injector.get('$q');
		$httpBackend = $injector.get('$httpBackend');
		$http = $injector.get('$http');

		Delayed = $injector.get('Delayed');
		Ping = $injector.get('Ping');
		User = $injector.get('User');
		Car = $injector.get('Car');

		$httpBackend.when('POST', '/user').respond((method, url, data) => {
			return [200, foo = Object.assign({}, JSON.parse(data), {
				$uri: '/user/4',
				created_at: {
					$date: Date.now()
				}
			})];
		});

		$httpBackend.when('GET', '/user/1').respond(() => [200, JOHN]); // A fn will always return the updated object
		$httpBackend.when('GET', '/user/2').respond(() => [200, JANE]);
		$httpBackend.when('GET', '/user/3').respond(() => {
			if (anonymous !== null) {
				return [200, anonymous];
			} else {
				return [404];
			}
		});
	}));

	afterEach(() => {
		$httpBackend.verifyNoOutstandingRequest();
	});

	describe('potionProvider', () => {
		it('should provide a Potion instance', () => {
			expect(provider.$get($cacheFactory, $q, $http)).not.toBeUndefined();
		});

		describe('.config()', () => {
			it('should configure Potion({prefix, cache}) properties', () => {
				let config = {prefix: '/api'};
				provider.config(config);
				expect(provider.config()).toEqual(config);
				expect(provider.$get($cacheFactory, $q, $http).prefix).toEqual('/api');
			});
		});
	});

	describe('Item.fetch()', () => {
		it('should make a XHR request', (done) => {
			$httpBackend.expect('GET', '/ping/1').respond(200, {pong: true});

			Ping.fetch(1).then(() => {
				done();
			});

			$httpBackend.flush();
		});

		it('should correctly deserialize Potion server response', (done) => {
			User.fetch(1).then((user: User) => {
				expect(user.id).toEqual(1);
				expect(user.name).toEqual(JOHN.name);
				expect(user.createdAt instanceof Date).toBe(true);
				done();
			});

			$httpBackend.flush();
		});

		it('should have a static route that returns valid JSON', (done) => {
			$httpBackend.expect('GET', '/user/names').respond(200, ['John Doe', 'Jane Doe']);

			User.names().then((names) => {
				expect(Array.isArray(names)).toBe(true);
				expect(names[0]).toEqual(JOHN.name);
				done();
			});

			$httpBackend.flush();
		});

		it('should have a instance route that returns valid JSON', (done) => {
			$httpBackend.expect('GET', '/user/1/attributes').respond(200, {
				height: 168,
				weight: 72
			});

			User.fetch(1).then((user: User) => {
				user.attributes().then((attrs) => {
					expect(attrs.height).toEqual(168);
					expect(attrs.weight).toEqual(72);
					done();
				});
			});

			$httpBackend.flush();
		});

		it('should not trigger more requests for consequent requests for the same resource, if the first request is still pending', (done) => {
			let count = 0;

			$httpBackend.expect('GET', '/delayed/1').respond(() => {
				count++;
				return [200, {}];
			});

			$q.all([Delayed.fetch(1), Delayed.fetch(1)]).then(() => {
				expect(count).toEqual(1);
				done();
			});

			$httpBackend.flush();
		});

		it('should use $cacheFactory (by default) to cache the item', (done) => {
			let cache = $cacheFactory.get('potion');

			expect(cache).not.toBeUndefined();

			User.fetch(1).then(() => {
				expect(cache.get('/user/1')).not.toBeUndefined();
				done();
			});

			$httpBackend.flush();
		});

		it('should skip caching if {cache} option is set to false', (done) => {
			let cache = $cacheFactory.get('potion');

			$httpBackend.expect('GET', '/user/4').respond(() => [200, {}]);
			expect(cache).not.toBeUndefined();

			User.fetch(4, {cache: false}).then(() => {
				expect(cache.get('/user/4')).toBeUndefined();
				done();
			});

			$httpBackend.flush();
		});

		it('should automatically resolve references', (done) => {
			const AUDI = {
				$uri: '/car/1',
				user: {$ref: '/user/1'},
				model: 'Audi A3'
			};

			$httpBackend.expect('GET', '/car/1').respond(() => [200, AUDI]);

			Car.fetch(1).then((car: Car) => {
				expect(car.model).toEqual(AUDI.model);
				expect(car.user instanceof User).toBe(true);
				expect(car.user.id).toEqual(1);
				expect(car.user.name).toEqual(JOHN.name);
				done();
			});

			$httpBackend.flush();
		});
	});

	describe('Item.query()', () => {
		beforeEach(() => {
			$httpBackend.when('GET', '/user').respond((method, url, data) => {
				let {page, perPage} = JSON.parse(data);
				let response = [{$ref: JOHN.$uri}, {$ref: JANE.$uri}];

				if (page && perPage) {
					response = toPages(response, perPage)[page - 1]; // If pagination params are sent, return the appropriate page
				}

				return [200, response, {
					'X-Total-Count': 2
				}];
			});
		});

		it('should return a Pagination object', (done) => {
			User.query({paginate: true}).then((users: Pagination<any>) => {
				expect(users instanceof Pagination).toBe(true);
				expect(users.length).toEqual(2);
				expect(users.page).toEqual(1);
				expect(users.perPage).toEqual(5); // Default value if not set with options
				expect(users.pages).toEqual(1);
				done();
			});

			$httpBackend.flush();
		});

		it('should retrieve all instances of the Item', (done) => {
			User.query({paginate: true}).then((users: User[]) => {
				expect(users.length).toEqual(2);
				for (let user of users) {
					expect(user instanceof User).toBe(true);
				}
				done();
			});

			$httpBackend.flush();
		});

		it('should return the right page when called with pagination params ({page, perPage})', (done) => {
			User.query({paginate: true, page: 2, perPage: 1, cache: false}).then((users: Pagination<User>) => {
				expect(users.length).toEqual(1);
				expect(users.page).toEqual(2);
				expect(users.perPage).toEqual(1);
				expect(users.pages).toEqual(2);
				expect(users.toArray()[0].id).toEqual(2); // Jane
				done();
			});

			$httpBackend.flush();
		});

		it('should update query if {page} is set on the pagination object', (done) => {
			User.query({paginate: true, page: 2, perPage: 1, cache: false}).then((users: Pagination<User>) => {
				users.page = 1;
				users.changePageTo(1).then(() => {
					expect(users.page).toEqual(1);
					expect(users.toArray()[0].id).toEqual(1); // John
					done();
				});
			});

			$httpBackend.flush();
		});
	});

	describe('Item()', () => {
		describe('.update()', () => {
			it('should update the Item', (done) => {
				$httpBackend.expect('PATCH', '/user/1').respond((method, url, data) => [200, Object.assign(JOHN, {}, JSON.parse(data))]);

				User.fetch(1).then((user: User) => {
					let name = 'John Foo Doe';
					user.update({name}).then(() => {
						User.fetch(1).then((user: User) => {
							expect(user.name).toEqual(name);
							done();
						});
					});
				});

				$httpBackend.flush();
			});
		});

		describe('.destroy()', () => {
			it('should destroy the Item', (done) => {
				$httpBackend.expect('DELETE', '/user/3').respond(() => {
					anonymous = null;
					return [200];
				});

				User.fetch(3).then((user: User) => {
					user.destroy().then(() => {
						User.fetch(3, {cache: false}).then(null, (error) => {
							expect(error).not.toBeUndefined();
							done();
						});
					});
				});

				$httpBackend.flush();
			});
		});

		describe('.save()', () => {
			it('should save the Item', (done) => {
				let name = 'Foo Bar';
				let user = new User({name});

				$httpBackend.when('GET', '/user/4').respond(() => {
					if (foo !== null) {
						return [200, foo];
					} else {
						return [404];
					}
				});

				user.save().then(() => {
					User.fetch(4).then((user: User) => {
						expect(user.id).toEqual(4);
						expect(user.name).toEqual(name);
						done();
					});
				});

				$httpBackend.flush();
			});
		});
	});
});


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

let anonymous = {
	$uri: '/user/3',
	name: 'Anonymous',
	created_at: {
		$date: 1451060269000
	}
};

let foo = null;

// Resources
class Delayed extends Item {}
class Ping extends Item {}
class User extends Item {
	static names = Route.GET<string[]>('/names');

	attributes = Route.GET<{height: number, weight: number}>('/attributes');
	name: string;
	createdAt: Date;
}
class Car extends Item {
	model: string;
	user: any;
}

// Configure Potion,
// and register resources
angular
	.module('test', ['potion'])
	.config(['potionProvider', (potionProvider) => {
		potionProvider.config({prefix: ''});
	}])
	.factory('Delayed', ['potion', (potion) => {
		potion.register('/delayed', Delayed);
		return Delayed;
	}])
	.factory('Ping', ['potion', (potion) => {
		potion.register('/ping', Ping);
		return Ping;
	}])
	.factory('User', ['potion', (potion) => {
		potion.register('/user', User);
		return User;
	}])
	.factory('Car', ['potion', (potion) => {
		potion.register('/car', Car);
		return Car;
	}]);
