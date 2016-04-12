// Mock request responses using
// https://www.npmjs.com/package/fetch-mock
import * as fetchMock from 'fetch-mock';

import {
	Potion,
	PotionItemCache,
	Item,
	Route,
	Pagination
} from './fetch';


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


// In memory cache
class MockMemcache implements PotionItemCache<any> {
	private _memcache = {};

	get(key: string) {
		return this._memcache[key];
	}

	put(key, item) {
		return this._memcache[key] = item;
	}

	remove(key: string) {
		delete this._memcache[key];
	}

	removeAll() {
		this._memcache = {};
	}
}

let cache = new MockMemcache();

describe('potion/fetch', () => {
	beforeEach(() => {
		// Mock before each test routes that are reused more than a few times
		fetchMock.mock(<any>{
			greed: 'bad',
			routes: [
				{
					matcher: 'http://localhost/ping/1',
					method: 'GET',
					response: {$uri: '/ping/1', pong: 1}
				},
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
		// Clean the mock cache for testing purposes
		cache.removeAll();
	});

	describe('Item.fetch()', () => {
		it('should make a XHR request', (done) => {
			Ping.fetch(1).then(() => {
				expect(fetchMock.called('http://localhost/ping/1')).toBe(true);
				done();
			});
		});

		it('should correctly deserialize Potion server response', (done) => {
			User.fetch(1).then((user: User) => {
				expect(user.id).toEqual(1);
				expect(user.name).toEqual(JOHN.name);
				expect(user.createdAt instanceof Date).toBe(true);
				done();
			});
		});

		it('should have a instance route that returns valid JSON', (done) => {
			fetchMock.mock('http://localhost/user/1/attributes', 'GET', {
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
		});

		it('should have a static route that returns valid JSON', (done) => {
			fetchMock.mock('http://localhost/user/names', 'GET', [JOHN.name, JANE.name]);

			User.names().then((names) => {
				expect(Array.isArray(names)).toBe(true);
				expect(names[0]).toEqual(JOHN.name);
				done();
			});
		});

		it('should not trigger more requests for consequent requests for the same resource, if the first request is still pending', (done) => {
			fetchMock.mock('http://localhost/delayed/1', 'GET', new Promise((resolve) => {
				setTimeout(() => resolve({$uri: '/delayed/1'}), 150);
			}));

			Promise.all([Delayed.fetch(1), Delayed.fetch(1)]).then(() => {
				expect(fetchMock.calls('http://localhost/delayed/1').length).toEqual(1);
				done();
			});
		});

		it('should use in memory cache (by default) to retrieve the Item', (done) => {
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

		it('should skip caching if {cache} option is set to false', (done) => {
			Ping.fetch(1, {cache: false}).then(() => {
				expect(cache.get('/ping/1')).toBeUndefined();
				done();
			});
		});

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
			User.query().then((users: Pagination<User>) => {
				expect(users instanceof Pagination).toBe(true);
				expect(users.length).toEqual(2);
				expect(users.page).toEqual(1);
				expect(users.perPage).toEqual(5); // Default value if not set with options
				expect(users.pages).toEqual(1);
				done();
			});
		});

		it('should contain instances of an Item', (done) => {
			User.query().then((users: User[]) => {
				for (let user of users) {
					expect(user instanceof User).toBe(true);
				}
				done();
			});
		});

		it('should return the right page when called with pagination params ({page, perPage})', (done) => {
			User.query({page: 2, perPage: 1}).then((users: Pagination<User>) => {
				expect(users.length).toEqual(1);
				expect(users.page).toEqual(2);
				expect(users.perPage).toEqual(1);
				expect(users.pages).toEqual(2);
				done();
			});
		});
	});

	describe('Item instance', () => {
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
					// TODO: we need to properly create a way to generate ids based on how many users there are
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


// Create Potion API
let potion = new Potion({prefix: 'http://localhost'});
let potionNoItemCache = new Potion({cache: null, prefix: 'http://localhost'});
let potionCustomCache = new Potion({cache, prefix: 'http://localhost'});

// Potion resources
class Delayed extends Item {}
class Ping extends Item {}

class User extends Item {
	static names = Route.GET('/names');

	attributes = Route.GET('/attributes');
	name: string;
	createdAt: Date;
}

class Car extends Item {
	model: string;
	user: User;
}

// Register API resources
potionCustomCache.register('/ping', Ping);
potionNoItemCache.register('/delayed', Delayed);

potion.register('/user', User);
potion.register('/car', Car);

function toPages(items: any[], perPage: number): Array<any[]> {
	let i;
	let j;
	let pages = [];

	for (i = 0, j = items.length; i < j; i+=perPage) {
		pages.push(items.slice(i, i + perPage));
	}

	return pages;
}
