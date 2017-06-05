/* tslint:disable: prefer-function-over-method max-classes-per-file */

import {isFunction} from './utils';
import {PotionBase} from './potion';
import {Item} from './item';
import {Route} from './route';


describe('potion/core', () => {
	describe('Route', () => {
		class User extends Item {
			static getNames: any = Route.GET<string[]>('/names');
			static patchNames: any = Route.PATCH<string[]>('/names');
			static addName: any = Route.PUT<string[]>('/names');
			static setNames: any = Route.POST<string[]>('/names');
			static deleteName: any = Route.DELETE<string[]>('/names');
			attributes: any = Route.GET<{height: number, weight: number}>('/attributes');
		}

		beforeEach(() => {
			const names = [
				'John Doe',
				'Jane Doe'
			];

			class Potion extends PotionBase {
				protected request(uri: string, {method, data}: any): Promise<any> {
					switch (uri) {
						case '/user/1':
							return Promise.resolve({data: {$uri: '/user/1'}});
						case '/user/names':
							if ((method === 'POST' || method === 'PATCH') && Array.isArray(data)) {
								names.push(...data);
							} else if (method === 'PUT') {
								names.push(data);
							} else if (method === 'DELETE') {
								names.splice(names.indexOf(data), 1);
							}
							return Promise.resolve({
								data: names,
								headers: {}
							});
						default:
							break;
					}

					return Promise.resolve({});
				}
			}

			const potion = new Potion();
			potion.register('/user', User);

		});

		it('should allow for usage as instance property', done => {
			User.fetch(1).then((user: User) => {
				expect(isFunction(user.attributes)).toBe(true);
				done();
			});
		});

		it('should allow for usage as static property', () => {
			expect(isFunction(User.getNames)).toBe(true);
		});

		describe('.GET()', () => {
			it('should GET', done => {
				User.getNames().then((names: any) => {
					expect(names instanceof Array).toBe(true);
					expect(names.length).toEqual(2);
					done();
				});
			});
		});

		describe('.POST()', () => {
			it('should POST', done => {
				User.setNames(['Foo', 'Bar']).then((names: any) => {
					expect(names instanceof Array).toBe(true);
					expect(names.length).toEqual(4);
					done();
				});
			});
		});

		describe('.PATCH()', () => {
			it('should PATCH', done => {
				User.patchNames(['Foo']).then((names: any) => {
					expect(names instanceof Array).toBe(true);
					expect(names.length).toEqual(3);
					done();
				});
			});
		});

		describe('.PUT()', () => {
			it('should PUT', done => {
				User.addName('Foo').then((names: any) => {
					expect(names instanceof Array).toBe(true);
					expect(names.length).toEqual(3);
					done();
				});
			});
		});

		describe('.DELETE()', () => {
			it('should DELETE', done => {
				User.deleteName('Jane Doe').then((names: any) => {
					expect(names instanceof Array).toBe(true);
					expect(names.length).toEqual(1);
					done();
				});
			});
		});
	});
});
