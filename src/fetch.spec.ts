// Mock request responses using
// https://www.npmjs.com/package/fetch-mock
import * as fetchMock from 'fetch-mock';

import {
	Potion,
	Pagination,
	Item,
	Route
} from './fetch';

import {toPages} from '../test/utils';


describe('potion/fetch', () => {
	beforeEach(() => {
		// Mock before each test routes that are reused more than a few times
		fetchMock.mock(<any>{
			greed: 'bad',
			routes: [
				{
					matcher: 'http://localhost/user/1',
					method: 'GET',
					response: () => JOHN // A fn will always return the updated object
				},
				{
					matcher: 'http://localhost/user/2',
					method: 'GET',
					response: () => JANE
				}
			]
		});
	});

	afterEach(() => {
		fetchMock.restore();
	});

	describe('Item.fetch()', () => {
		it('should make a XHR request', (done) => {
			fetchMock.mock('http://localhost/ping/1', 'GET', {});

			Ping.fetch(1).then(() => {
				expect(fetchMock.called('http://localhost/ping/1')).toBe(true);
				done();
			});
		});

		it('should use in memory cache by default to retrieve an Item', (done) => {
			fetchMock.mock('http://localhost/user/5', 'GET', {
				$uri: '/user/5',
				name: 'James Dean',
				created_at: {
					$date: 1451060269000
				}
			});

			User.fetch(5).then(() => {
				expect(User.store.cache.get('/user/5')).not.toBeUndefined();
				User.fetch(5).then(() => {
					expect(fetchMock.calls('http://localhost/user/5').length).toEqual(1);
					done();
				});
			});
		});

		it('should use \'no-cache\' for the fetch() request if {cache} option is set to false', (done) => {
			fetchMock.mock('http://localhost/ping/1', 'GET', {$uri: '/ping/1', pong: 1});

			Ping.fetch(1, {cache: false}).then(() => {
				expect((<any>fetchMock.lastOptions('http://localhost/ping/1')).cache).toEqual('no-cache');
				done();
			});
		});

		// TODO: move this to potion/base spec
		it('should automatically resolve references', (done) => {
			const AUDI = {
				$uri: '/car/1',
				user: {$ref: '/user/1'},
				model: 'Audi A3'
			};

			fetchMock.mock('http://localhost/car/1', 'GET', AUDI);

			Car.fetch(1).then((car: Car) => {
				expect(car.model).toEqual(AUDI.model);
				expect(car.user instanceof User).toBe(true);
				expect(car.user.id).toEqual(1);
				expect(car.user.name).toEqual(JOHN.name);
				done();
			});
		});
	});

	// TODO: probably/maybe move this to potion/base spec
	describe('Item.query()', () => {
		beforeEach(() => {
			fetchMock.mock('http://localhost/user', 'GET', (url, opts: any) => {
				let {page, perPage} = JSON.parse(opts.body);
				let response = {body: [{$ref: JOHN.$uri}, {$ref: JANE.$uri}]};

				if (page && perPage) {
					Object.assign(response, {
						body: toPages(response.body, perPage)[page - 1], // If pagination params are sent, return the appropriate page
						headers: {
							'X-Total-Count': 2
						}
					});
				}

				return response;
			});
		});

		it('should return a Pagination object', (done) => {
			User.query({paginate: true}).then((users: Pagination<User>) => {
				expect(users instanceof Pagination).toBe(true);
				expect(users.length).toEqual(2);
				expect(users.page).toEqual(1);
				expect(users.perPage).toEqual(5); // Default value if not set with options
				expect(users.pages).toEqual(1);
				done();
			});
		});

		it('should contain instances of an Item', (done) => {
			User.query({paginate: true}).then((users: User[]) => {
				for (let user of users) {
					expect(user instanceof User).toBe(true);
				}
				done();
			});
		});

		it('should return the right page when called with pagination params ({page, perPage})', (done) => {
			User.query({paginate: true, page: 2, perPage: 1}).then((users: Pagination<User>) => {
				expect(users.length).toEqual(1);
				expect(users.page).toEqual(2);
				expect(users.perPage).toEqual(1);
				expect(users.pages).toEqual(2);
				expect(users.toArray()[0].id).toEqual(2); // Jane
				done();
			});
		});

		it('should update query if {page} is set on the pagination object', (done) => {
			User.query({paginate: true, page: 2, perPage: 1}).then((users: Pagination<User>) => {
				users.changePageTo(1).then(() => {
					expect(users.page).toEqual(1);
					expect(users.toArray()[0].id).toEqual(1); // John
					done();
				});
			});
		});
	});
	
	// TODO: probably/maybe move this to potion/base spec
	describe('Item()', () => {
		describe('.update()', () => {
			it('should update the Item', (done) => {
				fetchMock.mock('http://localhost/user/1', 'PATCH', (url, opts: any) => {
					return Object.assign(JOHN, {}, JSON.parse(opts.body));
				});

				User.fetch(1).then((user: User) => {
					let name = 'John Foo Doe';
					user.update({name}).then(() => {
						User.fetch(1).then((user: User) => {
							expect(user.name).toEqual(name);
							done();
						});
					});
				});
			});
		});

		describe('.destroy()', () => {
			it('should destroy the Item', (done) => {
				let anonymous = {
					$uri: '/user/3',
					name: 'Anonymous',
					created_at: {
						$date: 1451060269000
					}
				};

				fetchMock.mock('http://localhost/user/3', 'GET', (): any => {
					if (anonymous !== null) {
						return anonymous;
					} else {
						return 404;
					}
				});

				fetchMock.mock('http://localhost/user/3', 'DELETE', () => {
					anonymous = null;
					return 200;
				});

				User.fetch(3).then((user: User) => {
					user.destroy().then(() => {
						User.fetch(3).then(null, (error) => {
							expect(error).not.toBeUndefined();
							done();
						});
					});
				});
			});
		});

		describe('.save()', () => {
			it('should save the Item', (done) => {
				let name = 'Foo Bar';
				let user = new User({name});
				let foo = null;

				fetchMock.mock('http://localhost/user', 'POST', (url, opts: any) => {
					return foo = Object.assign({}, JSON.parse(opts.body), {
						$uri: '/user/4',
						created_at: {
							$date: Date.now()
						}
					});
				});

				fetchMock.mock('http://localhost/user/4', 'GET', () => {
					if (foo !== null) {
						return foo;
					} else {
						return 404;
					}
				});

				user.save().then(() => {
					User.fetch(4).then((user: User) => {
						expect(user.id).toEqual(4);
						expect(user.name).toEqual(name);
						done();
					});
				});
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

// Potion instance
let potion = new Potion({prefix: 'http://localhost'});

// Potion resources
@potion.registerAs('/ping')
class Ping extends Item {}

@potion.registerAs('/delayed')
class Delayed extends Item {}

@potion.registerAs('/user')
class User extends Item {
	static names = Route.GET<string[]>('/names');

	attributes = Route.GET<{height: number, weight: number}>('/attributes');
	name: string;
	createdAt: Date;
}

@potion.registerAs('/car')
class Car extends Item {
	model: string;
	user: User;
}
