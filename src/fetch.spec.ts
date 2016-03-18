// Needs to be included.
// Include before we load Potion impl. using fetch.
import 'isomorphic-fetch';

import {Potion} from './fetch';
import {Item, Route, Cache} from "./potion";

// Mock request responses using
// https://www.npmjs.com/package/fetch-mock
import fetchMock from 'fetch-mock';
import {Observable} from "rxjs/Observable";
import 'rxjs/add/observable/merge';


describe('potion/fetch', () => {
	beforeAll(() => {
		fetchMock.mock('http://localhost/delayed/1', new Promise((resolve) => {
			setTimeout(() => resolve({$uri: '/delayed/1', delay: 500}), 2500);
		}));

		fetchMock.mock('http://localhost/ping/1', {$uri: '/ping/1', pong: 1});

		fetchMock.mock('http://localhost/user', [{$ref: '/user/1'}, {$ref: '/user/2'}]);
		fetchMock.mock('http://localhost/user/names', ['John Doe']);
		fetchMock.mock('http://localhost/user/1', {
			$uri: '/user/1',
			name: 'John Doe',
			created_at: {$date: 1451060269000}
		});
		fetchMock.mock('http://localhost/user/1/attributes', {
			height: 168,
			weight: 72
		});
		fetchMock.mock('http://localhost/user/2', {
			$uri: '/user/2',
			name: 'Jane Doe'
		});

		fetchMock.mock('http://localhost/car/1', {
			$uri: '/car/1',
			model: 'Audi A3',
			user: {$ref: '/user/1'}
		});
	});

	afterAll(() => {
		fetchMock.restore();
	});

	describe('Item.fetch()', () => {

		it('should make a XHR request', (done) => {
			Ping.fetch(1).subscribe(() => {
				expect(fetchMock.called('http://localhost/ping/1')).toBe(true);
				done();
			});
		});

		it('should correctly deserialize Potion server response', (done) => {
			User.fetch(1).subscribe((user: User) => {
				expect(user.id).toEqual(1);
				expect(user.name).toEqual('John Doe');
				expect(user.createdAt instanceof Date).toBe(true);
				done();
			});
		});

		it('should have a instance route that returns valid JSON', (done) => {
			User.fetch(1).subscribe((user: User) => {
				user.attributes().subscribe((attrs) => {
					expect(attrs.height).toEqual(168);
					expect(attrs.weight).toEqual(72);
					done();
				});
			});
		});

		it('should have a static route that returns valid JSON', (done) => {
			User.names().subscribe((names) => {
				expect(Array.isArray(names)).toBe(true);
				expect(names[0]).toEqual('John Doe');
				done();
			});
		});

		it('should not trigger more requests for consequent requests for the same resource, if the first request is still pending', (done) => {
			let count = 1;
			Observable.merge(Delayed.fetch(1), Delayed.fetch(1)).subscribe((delayed: Delayed) => {
				if (count === 2) {
					// TODO: check how many times this resource has been requested
					// Blocked by https://github.com/wheresrhys/fetch-mock/issues/75
					// expect(delayed.delay).toEqual(500);
					done();
				}

				count++;
			});
		});

		it('should retrieve from cache (given that a cache was provided)', (done) => {
			Ping.fetch(1).subscribe(() => {
				expect(fetchMock.calls('http://localhost/ping/1').length).toEqual(1);
				done();
			});
		});

		it('should automatically resolve references', (done) => {
			Car.fetch(1).subscribe((car: Car) => {
				expect(car.model).toEqual('Audi A3');
				expect(car.user instanceof User).toBe(true);
				expect(car.user.id).toEqual(1);
				expect(car.user.name).toEqual('John Doe');
				done();
			});
		});
	});

	describe('Item.query()', () => {
		it('should retrieve all instances of the Item', (done) => {
			User.query().subscribe((users: User[]) => {
				expect(users.length).toEqual(2);
				console.log(users);
				for (let user of users) {
					expect(user instanceof User).toBe(true);
				}
				done();
			});
		});
	});
});


// In memory cache
class JSCache implements Cache {
	private _store = {};

	get(id: string) {
		return this._store[id];
	}

	set(id, item) {
		return this._store[id] = item;
	}
}


// Create Potion API
const potion = new Potion({prefix: 'http://localhost', cache: new JSCache()});

// Potion resources
class Delayed extends Item {
	delay: number;
}

class Ping extends Item {
}

class User extends Item {
	attributes = Route.GET('/attributes');
	name: string;
	createdAt: Date;

	static names = Route.GET('/names');
}

class Car extends Item {
	model: string;
	user: User;
}

// Register API resources
potion.register('/delayed', Delayed);
potion.register('/ping', Ping);
potion.register('/user', User);
potion.register('/car', Car);
