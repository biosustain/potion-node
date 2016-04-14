// Mock request responses using
// https://www.npmjs.com/package/fetch-mock
import * as fetchMock from 'fetch-mock';

import {
	Potion,
	Item
} from './fetch';


describe('potion/fetch', () => {
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

		it('should use \'no-cache\' for the fetch() request if {cache} option is set to false', (done) => {
			fetchMock.mock('http://localhost/ping/1', 'GET', {$uri: '/ping/1', pong: 1});

			Ping.fetch(1, {cache: false}).then(() => {
				expect((<any>fetchMock.lastOptions('http://localhost/ping/1')).cache).toEqual('no-cache');
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
	});
});


// Potion instance
let potion = new Potion({prefix: 'http://localhost'});

// Potion resources
@potion.registerAs('/ping')
class Ping extends Item {}

@potion.registerAs('/user')
class User extends Item {
	name: string;
}
