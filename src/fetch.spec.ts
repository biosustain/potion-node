/* tslint:disable: no-magic-numbers */
// Mock request responses using
// https://www.npmjs.com/package/fetch-mock
import * as fetchMock from 'fetch-mock';
import {Item, Potion} from './fetch';


describe('potion/fetch', () => {
    afterEach(() => {
        fetchMock.restore();
    });

    describe('Potion()', () => {
        describe('.request()', () => {
            let potion: any;

            beforeEach(() => {
                potion = new Potion({prefix: 'http://localhost'});
            });

            it('should make a XHR request', () => {
                (fetchMock as any).get('http://localhost/ping', {});
                potion.fetch('http://localhost/ping');
                expect(fetchMock.called('http://localhost/ping')).toBe(true);
            });

            it('should use \'no-cache\' for the window.fetch() request {cache} option if {cache} option is set to false', () => {
                (fetchMock as any).get('http://localhost/ping', {});
                potion.fetch('http://localhost/ping', {cache: false});
                expect((fetchMock.lastOptions('http://localhost/ping') as any).cache).toEqual('no-cache');
            });

            it('should use the appropriate request method set by the {method} option', () => {
                fetchMock.mock('http://localhost/ping', {}, {method: 'PATCH'});
                potion.fetch('http://localhost/ping', {method: 'PATCH'});
                expect(fetchMock.called('http://localhost/ping')).toBe(true);
            });

            it('should pass anything set on {body} option as the {body} property of the request in JSON format', () => {
                let body = '';
                let headers: Headers = new Headers();
                (fetchMock as any).post('http://localhost/ping', (_: any, opts: any) => {
                    headers = opts.headers;
                    body = opts.body;
                    return 200;
                });

                potion.fetch('http://localhost/ping', {method: 'POST', body: {pong: true}});

                expect(fetchMock.called('http://localhost/ping')).toBe(true);

                expect(headers).not.toBeUndefined();
                expect(headers.get('accept')).toEqual('application/json');
                expect(headers.get('content-type')).toEqual('application/json');

                expect(body.length).not.toBe(0);
                expect(JSON.parse(body)).toEqual({pong: true});
            });

            it('should pass on the query params from the {params} option', () => {
                (fetchMock as any).get('http://localhost/ping?pong=true&count=1', 200);
                potion.fetch('http://localhost/ping', {method: 'GET', params: {pong: true, count: 1}});
                expect(fetchMock.called('http://localhost/ping?pong=true&count=1')).toBe(true);
            });

            it('should return a Promise', () => {
                (fetchMock as any).get('http://localhost/ping', {});
                expect(potion.fetch('http://localhost/ping') instanceof Promise).toBe(true);
            });

            it('should return a Promise with data', done => {
                (fetchMock as any).get('http://localhost/ping', {body: {pong: true}});
                potion.fetch('http://localhost/ping').then((data: any) => {
                    expect(data).not.toBeUndefined();
                    expect(data).toEqual({pong: true});
                    done();
                });
            });
        });
    });

    describe('Item()', () => {
        describe('.fetch()', () => {
            it('should use a memory cache by default to store and retrieve items', done => {
                const potion = new Potion({prefix: 'http://localhost'});

                @potion.registerAs('/user')
                class User extends Item {}

                (fetchMock as any).get('http://localhost/user/1', {$uri: '/user/1'});

                User.fetch(1).then(() => {
                    expect(potion.cache.get('/user/1')).not.toBeUndefined();
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

