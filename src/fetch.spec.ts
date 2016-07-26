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

	describe('Potion()', () => {
		describe('.request()', () => {
			let potion;

			beforeEach(() => {
				potion = new Potion({prefix: 'http://localhost'});
			});

			it('should make a XHR request', () => {
				fetchMock.mock('http://localhost/ping', 'GET', {});
				potion.fetch('http://localhost/ping');
				expect(fetchMock.called('http://localhost/ping')).toBe(true);
			});

			it('should use \'no-cache\' for the window.fetch() request {cache} option if {cache} option is set to false', () => {
				fetchMock.mock('http://localhost/ping', 'GET', {});
				potion.fetch('http://localhost/ping', {cache: false});
				expect((fetchMock.lastOptions('http://localhost/ping') as any).cache).toEqual('no-cache');
			});

			it('should use the appropriate request method set by the {method} option', () => {
				fetchMock.mock('http://localhost/ping', 'PATCH', {});
				potion.fetch('http://localhost/ping', {method: 'PATCH'});
				expect(fetchMock.called('http://localhost/ping')).toBe(true);
			});

			it('should pass anything set on {data} option as the {body} property of the request in JSON format', () => {
				let body = null;
				let headers: Headers = null;
				fetchMock.mock('http://localhost/ping', 'POST', (url, opts: any) => {
					headers = opts.headers;
					body = opts.body;
					return 200;
				});

				potion.fetch('http://localhost/ping', {method: 'POST', data: {pong: true}});

				expect(fetchMock.called('http://localhost/ping')).toBe(true);

				expect(headers).not.toBeNull();
				expect(headers.get('accept')).toEqual('application/json');
				expect(headers.get('content-type')).toEqual('application/json');

				expect(body).not.toBeNull();
				expect(JSON.parse(body)).toEqual({pong: true});
			});

			it('should pass on the query params from the {search} option', () => {
				fetchMock.mock('http://localhost/ping?pong=true&count=1', 'GET', 200);
				potion.fetch('http://localhost/ping', {method: 'GET', search: {pong: true, count: 1}});
				expect(fetchMock.called('http://localhost/ping?pong=true&count=1')).toBe(true);
			});

			it('should return a Promise', () => {
				fetchMock.mock('http://localhost/ping', 'GET', {});
				expect(potion.fetch('http://localhost/ping') instanceof Promise).toBe(true);
			});

			it('should return a Promise with data', (done) => {
				fetchMock.mock('http://localhost/ping', 'GET', {body: {pong: true}});
				potion.fetch('http://localhost/ping').then((data) => {
					expect(data).not.toBeUndefined();
					expect(data).toEqual({pong: true});
					done();
				});
			});
		});
	});

	describe('Item()', () => {
		describe('.fetch()', () => {
			it('should use a memory cache by default to store and retrieve items', (done) => {
				let potion = new Potion({prefix: 'http://localhost'});

				@potion.registerAs('/user')
				class User extends Item {}

				fetchMock.mock('http://localhost/user/1', 'GET', {$uri: '/user/1'});

				User.fetch(1).then(() => {
					expect(User.store.cache.get('/user/1')).not.toBeUndefined();
					User.fetch(1).then((user: User) => {
						expect(fetchMock.calls('http://localhost/user/1').length).toEqual(1);
						expect(user).not.toBeUndefined();
						done();
					});
				});
			});
		});
	});
});

