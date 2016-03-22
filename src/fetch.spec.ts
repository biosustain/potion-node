// Needs to be included.
// Include before we load Potion impl. using fetch.
// import 'whatwg-fetch';

import {Potion} from './fetch';
import {
	Item,
	Route,
	Cache
} from './potion';

// Mock request responses using
// https://www.npmjs.com/package/fetch-mock
import fetchMock from 'fetch-mock';

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

let foo = null;

let anonymous = {
	$uri: '/user/3',
	name: 'Anonymous',
	created_at: {
		$date: 1451060269000
	}
};

const audi = {
	$uri: '/car/1',
	user: {$ref: '/user/1'},
	model: 'Audi A3'
};

const delay = new Promise((resolve) => {
	setTimeout(() => resolve({$uri: '/delayed/1', delay: 500}), 150);
});

const routes = [
	{
		matcher: 'http://localhost/delayed/1',
		method: 'GET',
		response: delay
	},
	{
		matcher: 'http://localhost/ping/1',
		method: 'GET',
		response: {$uri: '/ping/1', pong: 1}
	},
	{
		matcher: 'http://localhost/user',
		method: 'GET',
		response: [{$ref: john.$uri}, {$ref: jane.$uri}]
	},
	{
		matcher: 'http://localhost/user',
		method: 'POST',
		response: (url, opts) => {
			// TODO: we need to properly create a way to generate ids based on how many users there are
			return foo = Object.assign({}, opts.body, {
				$uri: '/user/4',
				created_at: {
					$date: Date.now()
				}
			});
		}
	},
	{
		matcher: 'http://localhost/user/names',
		method: 'GET',
		response: ['John Doe', 'Jane Doe']
	},
	{
		matcher: 'http://localhost/user/1',
		method: 'GET',
		response: () => john // A fn will always return the update object
	},
	{
		matcher: 'http://localhost/user/1',
		method: 'PUT',
		response: (url, opts) => {
			return Object.assign(john, {}, opts.body);
		}
	},
	{
		matcher: 'http://localhost/user/1/attributes',
		method: 'GET',
		response: {
			height: 168,
			weight: 72
		}
	},
	{
		matcher: 'http://localhost/user/2',
		method: 'GET',
		response: () => jane
	},
	{
		matcher: 'http://localhost/user/3',
		method: 'GET',
		response: () => {
			if (anonymous !== null) {
				return anonymous;
			} else {
				return {
					status: 400,
					throws: {}
				};
			}
		}
	},
	{
		matcher: 'http://localhost/user/3',
		method: 'DELETE',
		response: () => {
			anonymous = null;
			return 200;
		}
	},
	{
		matcher: 'http://localhost/user/4',
		method: 'GET',
		response: () => {
			if (foo !== null) {
				return foo;
			} else {
				return {
					status: 400,
					throws: {}
				};
			}
		}
	},
	{
		matcher: 'http://localhost/car/1',
		method: 'GET',
		response: audi
	}
];

describe('potion/fetch', () => {
	beforeAll(() => {
		fetchMock.mock({routes, greed: 'bad'});
	});

	afterAll(() => {
		fetchMock.restore();
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
				expect(user.name).toEqual(john.name);
				expect(user.createdAt instanceof Date).toBe(true);
				done();
			});
		});

		it('should have a instance route that returns valid JSON', (done) => {
			User.fetch(1).then((user: User) => {
				user.attributes().then((attrs) => {
					expect(attrs.height).toEqual(168);
					expect(attrs.weight).toEqual(72);
					done();
				});
			});
		});

		it('should have a static route that returns valid JSON', (done) => {
			User.names().then((names) => {
				expect(Array.isArray(names)).toBe(true);
				expect(names[0]).toEqual(john.name);
				done();
			});
		});

		it('should not trigger more requests for consequent requests for the same resource, if the first request is still pending', (done) => {
			Promise.all([Delayed.fetch(1), Delayed.fetch(1)]).then(() => {
				expect(fetchMock.calls('http://localhost/delayed/1').length).toEqual(1);
				done();
			});
		});

		it('should retrieve from cache (given that a cache was provided)', (done) => {
			Ping.fetch(1).then(() => {
				expect(fetchMock.calls('http://localhost/ping/1').length).toEqual(1);
				done();
			});
		});

		it('should automatically resolve references', (done) => {
			Car.fetch(1).then((car: Car) => {
				expect(car.model).toEqual(audi.model);
				expect(car.user instanceof User).toBe(true);
				expect(car.user.id).toEqual(1);
				expect(car.user.name).toEqual(john.name);
				done();
			});
		});
	});

	describe('Item.query()', () => {
		it('should retrieve all instances of the Item', (done) => {
			User.query().then((users: User[]) => {
				expect(users.length).toEqual(2);
				for (let user of users) {
					expect(user instanceof User).toBe(true);
				}
				done();
			});
		});
	});

	describe('Item instance', () => {
		describe('.update()', () => {
			it('should update the Item', (done) => {
				User.fetch(1).then((user: User) => {
					const name = 'John Foo Doe';
					user.update({name}).then(() => {
						User.fetch(1).then((user: User) => {
							expect(user.name).toEqual(name);
							done();
						});
					});
				});
			});
		});

		describe('.delete()', () => {
			it('should delete the Item', (done) => {
				User.fetch(3).then((user: User) => {
					user['delete']().then(() => {
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
				const name = 'Foo Bar';
				const user = User.create({name});

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


// In memory cache
class JSCache implements Cache {
	private _memcache = {};

	get(id: string) {
		return this._memcache[id];
	}

	set(id, item) {
		return this._memcache[id] = item;
	}

	clear(id: string) {
		delete this._memcache[id];
	}
}


// Create Potion API
const potion = new Potion({prefix: 'http://localhost', cache: new JSCache()});
const potionNoCache = new Potion({prefix: 'http://localhost'});

// Potion resources
class Delayed extends Item {
	delay: number;
}

class Ping extends Item {
}

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
potionNoCache.register('/delayed', Delayed);
potion.register('/ping', Ping);
potion.register('/user', User);
potion.register('/car', Car);
