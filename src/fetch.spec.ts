// Needs to be included.
// Include before we load Potion impl. using fetch.
import 'isomorphic-fetch';

import {Potion} from './fetch';
import {Item, Route} from "./potion";

// Mock request responses using
// https://www.npmjs.com/package/fetch-mock
import fetchMock from 'fetch-mock';


describe('potion/fetch', () => {

	beforeEach(() => {
		fetchMock.mock('http://localhost/ping/1', {pong: 1});

		fetchMock.mock('http://localhost/user/names', ['John Doe']);

		fetchMock.mock('http://localhost/user/1', {
			name: 'John Doe'
		});
		fetchMock.mock('http://localhost/user/1/attributes', {
			height: 168,
			weight: 72
		});

	});

	afterEach(() => {
		fetchMock.restore();
	});

	describe('Item.fetch()', () => {

		it('should make a XHR request', (done) => {
			Ping.fetch(1).subscribe(() => {
				expect(fetchMock.called('http://localhost/ping/1')).toBe(true);
				done();
			});
		});

		it('should have an id and other properties', (done) => {
			User.fetch(1).subscribe((user: User) => {
				expect(user.id).toEqual(1);
				expect(user.name).toEqual('John Doe');
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
	});
});

// Create Potion API
const potion = new Potion();

// Potion resources
class Ping extends Item {}

class User extends Item {
	attributes = Route.GET('/attributes');
	name: string;

	static names = Route.GET('/names');
}

// Register API resources
potion.register('/ping', Ping);
potion.register('/user', User);
