import 'core-js/shim';
import 'reflect-metadata';
import angular from 'angular';
import 'angular-mocks';

import {Item, Route} from './angularjs';

const john = {
	$uri: '/user/1',
	name: 'John Doe',
	created_at: {
		$date: 1451060269000
	}
};

const jane = {
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

const audi = {
	$uri: '/car/1',
	user: {$ref: '/user/1'},
	model: 'Audi A3'
};

describe('potion/angularjs', () => {
	let $cacheFactory;
	let $q;
	let $httpBackend;

	// Make sure tslint does not complain about the var names
	/* tslint:disable: variable-name */
	let Delayed;
	let Ping;
	let User;
	let Car;
	/* tslint:enable: variable-name */

	beforeEach((<angular.IMockStatic>angular.mock).module('test'));

	beforeEach((<angular.IMockStatic>angular.mock).inject(function ($injector) {
		$cacheFactory = $injector.get('$cacheFactory');
		$q = $injector.get('$q');
		$httpBackend = $injector.get('$httpBackend');

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

		$httpBackend.when('GET', '/user/1').respond(() => [200, john]); // A fn will always return the updated object
		$httpBackend.when('GET', '/user/2').respond(() => [200, jane]);
		$httpBackend.when('GET', '/user/3').respond(() => {
			if (anonymous !== null) {
				return [200, anonymous];
			} else {
				return [400];
			}
		});
	}));

	afterEach(() => {
		$httpBackend.verifyNoOutstandingRequest();
	});

	describe('Item.fetch()', () => {
		it('should make a XHR request', (done) => {
			Ping.fetch(1).then(() => {
				done();
			});

			$httpBackend.expect('GET', '/ping/1').respond(200, {pong: true});
			$httpBackend.flush();
		});

		it('should correctly deserialize Potion server response', (done) => {
			User.fetch(1).then((user) => {
				expect(user.id).toEqual(1);
				expect(user.name).toEqual(john.name);
				expect(user.createdAt instanceof Date).toBe(true);
				done();
			});

			$httpBackend.flush();
		});

		it('should have a static route that returns valid JSON', (done) => {
			User.names().then((names) => {
				expect(Array.isArray(names)).toBe(true);
				expect(names[0]).toEqual(john.name);
				done();
			});

			$httpBackend.expect('GET', '/user/names').respond(200, ['John Doe', 'Jane Doe']);
			$httpBackend.flush();
		});

		it('should have a instance route that returns valid JSON', (done) => {
			User.fetch(1).then((user) => {
				user.attributes().then((attrs) => {
					expect(attrs.height).toEqual(168);
					expect(attrs.weight).toEqual(72);
					done();
				});
			});

			$httpBackend.expect('GET', '/user/1/attributes').respond(200, {
				height: 168,
				weight: 72
			});
			$httpBackend.flush();
		});

		it('should not trigger more requests for consequent requests for the same resource, if the first request is still pending', (done) => {
			let count = 0;

			$q.all([Delayed.fetch(1), Delayed.fetch(1)]).then(() => {
				expect(count).toEqual(1);
				done();
			});

			$httpBackend.expect('GET', '/delayed/1').respond(() => {
				count++;
				return [200, {delay: 250}];
			});
			$httpBackend.flush();
		});

		it('should use $cacheFactory (by default) to cache the item', (done) => {
			const cache = $cacheFactory.get('potion');

			expect(cache).not.toBeUndefined();

			User.fetch(1).then(() => {
				expect(cache.get('/user/1')).not.toBeUndefined();
				done();
			});

			$httpBackend.flush();
		});

		it('should automatically resolve references', (done) => {
			Car.fetch(1).then((car) => {
				expect(car.model).toEqual(audi.model);
				expect(car.user instanceof User).toBe(true);
				expect(car.user.id).toEqual(1);
				expect(car.user.name).toEqual(john.name);
				done();
			});

			$httpBackend.expect('GET', '/car/1').respond(() => [200, audi]);
			$httpBackend.flush();
		});
	});

	describe('Item.query()', () => {
		it('should retrieve all instances of the Item', (done) => {
			User.query().then((users: any[]) => {
				expect(users.length).toEqual(2);
				for (let user of users) {
					expect(user instanceof User).toBe(true);
				}
				done();
			});

			$httpBackend.expect('GET', '/user').respond(200, [{$ref: john.$uri}, {$ref: jane.$uri}]);
			$httpBackend.flush();
		});
	});

	describe('Item instance', () => {
		describe('.update()', () => {
			it('should update the Item', (done) => {
				User.fetch(1).then((user) => {
					const name = 'John Foo Doe';
					user.update({name}).then(() => {
						User.fetch(1).then((user) => {
							expect(user.name).toEqual(name);
							done();
						});
					});
				});

				$httpBackend.expect('PUT', '/user/1').respond((method, url, data) => [200, Object.assign(john, {}, JSON.parse(data))]);
				$httpBackend.flush();
			});
		});

		describe('.destroy()', () => {
			it('should destroy the Item', (done) => {
				User.fetch(3).then((user) => {
					user.destroy().then(() => {
						User.fetch(3).then(null, (error) => {
							expect(error).not.toBeUndefined();
							done();
						});
					});
				});

				$httpBackend.expect('DELETE', '/user/3').respond(() => {
					anonymous = null;
					return [200];
				});
				$httpBackend.flush();
			});
		});

		describe('.save()', () => {
			it('should save the Item', (done) => {
				const name = 'Foo Bar';
				const user = User.create({name});

				user.save().then(() => {
					User.fetch(4).then((user) => {
						expect(user.id).toEqual(4);
						expect(user.name).toEqual(name);
						done();
					});
				});

				$httpBackend.when('GET', '/user/4').respond(() => {
					if (foo !== null) {
						return [200, foo];
					} else {
						return [400];
					}
				});

				$httpBackend.flush();
			});
		});
	});
});


angular
	.module('test', ['potion'])
	.config(['potionProvider', (potionProvider) => {
		potionProvider.config({prefix: ''});
	}])
	.factory('Delayed', ['potion', (potion) => {
		class Delayed extends Item {
			delay: number;
		}

		potion.register('/delayed', Delayed);

		return Delayed;
	}])
	.factory('Ping', ['potion', (potion) => {
		class Ping extends Item {}

		potion.register('/ping', Ping);

		return Ping;
	}])
	.factory('User', ['potion', (potion) => {
		class User extends Item {
			static names = Route.GET('/names');

			attributes = Route.GET('/attributes');
			name: string;
			createdAt: Date;
		}

		potion.register('/user', User);

		return User;
	}])
	.factory('Car', ['potion', (potion) => {
		class Car extends Item {
			model: string;
			user: any;
		}

		potion.register('/car', Car);

		return Car;
	}]);
