/* tslint:disable:max-classes-per-file */

import {
	PotionBase,
	RequestOptions,
	ItemCache,
	FetchOptions
} from './potion';
import {Item} from './item';
import {Route} from './route';
import {deepOmap, toCamelCase} from '../utils';


describe('potion/core', () => {
	describe('Potion()', () => {
		let potion;

		beforeEach(() => {
			class Potion extends PotionBase {
				protected request(): Promise<any> {
					return Promise.resolve({});
				}
			}

			potion = new Potion({host: 'http://localhost:8080', prefix: '/api'});
		});

		afterEach(() => {
			potion = null;
		});

		it('should have {host, prefix, cache} configurable properties', () => {
			expect(potion.host).toEqual('http://localhost:8080');
			expect(potion.prefix).toEqual('/api');
		});

		describe('.register()', () => {
			it('should add new resources', () => {
				class User extends Item {}

				potion.register('/user', User);

				expect(Object.keys(potion.resources).length).toEqual(1);
				expect(potion.resources['/user']).not.toBeUndefined();
			});

			it('should return the added resource', () => {
				class User extends Item {}
				expect(potion.register('/user', User).name).toEqual(User.name);
			});
		});

		describe('.registerAs()', () => {
			it('should add new resources', () => {
				@potion.registerAs('/user')
				class User extends Item {}

				expect(Object.keys(potion.resources).length).toEqual(1);
				const resource = potion.resources['/user'];

				expect(resource).not.toBeUndefined();
				expect(resource === User).toBeTruthy();
			});
		});

		describe('.fetch()', () => {
			it('should correctly serialize {data, search} params when making a request', (done) => {
				let search: any;
				let data: any;

				class Potion extends PotionBase {
					protected request(_: string, options: RequestOptions): Promise<any> {
						data = options.data;
						search = options.search;

						return Promise.resolve({});
					}
				}

				const potion = new Potion();
				const today = new Date();

				potion
					.fetch('/user', {method: 'POST', data: {firstName: 'John', lastName: 'Doe', birthDate: today, features: [{eyeColor: 'blue'}]}, search: {isAdmin: false}})
					.then(() => {
						expect(Object.keys(data)).toEqual(['first_name', 'last_name', 'birth_date', 'features']);
						expect(Object.keys(search)).toEqual(['is_admin']);

						expect(data.birth_date).toEqual({$date: today.getTime()});
						expect(data.features).toEqual([{eye_color: 'blue'}]);

						done();
					});

			});
		});

		describe('.fetch()', () => {
			let cache;
			let memcache = {};

			const schema = {
				$schema: 'http://json-schema.org/draft-04/hyper-schema#',
				properties: {
					created_at: {
						additionalProperties: false,
						default: 'Fri, 23 Sep 2016 14:47:34 GMT',
						properties: {
							$date: {
								type: 'integer'
							}
						},
						type: 'object'
					}
				},
				type: 'object'
			};

			class User extends Item {
				static schema: (params?: any, options?: FetchOptions) => Promise<any> = Route.GET<any>('/schema');
				createdAt: Date;
			}

			class Car extends Item {
				user: User;
			}

			class Engine extends Item {
				car: any;
			}

			class Person extends Item {
				sibling: Person;
			}

			beforeEach(() => {
				class Potion extends PotionBase {
					protected request(uri: string): Promise<any> {
						switch (uri) {
							case '/user/schema':
								return Promise.resolve({data: schema});
							case '/user/1':
								return Promise.resolve({
									data: {
										$uri: '/user/1',
										created_at: {
											$date: 1451060269000
										}
									}
								});
							case '/user/00cc8d4b-9682-4655-ad78-1fa4b03e757d':
								return Promise.resolve({
									data: {
										$uri: '/user/00cc8d4b-9682-4655-ad78-1fa4b03e757d',
										created_at: {
											$date: 1451060269000
										}
									}
								});
							case '/car/1':
								return Promise.resolve({
									data: {
										$uri: '/car/1',
										user: {$ref: '/user/1'}
									},
									headers: {}
								});
							case '/engine/1':
								return Promise.resolve({
									data: {
										car: {$ref: '#'},
										type: 'Diesel'
									}
								});
							case '/person/1':
								return Promise.resolve({
									data: {
										$uri: '/person/1',
										sibling: {$ref: '/person/2'}
									}
								});
							case '/person/2':
								return Promise.resolve({
									data: {
										$uri: '/person/2',
										sibling: {$ref: '/person/1'}
									}
								});
							default:
								break;
						}

						return Promise.resolve({});
					}
				}

				class MockCache implements ItemCache<Item> {
					get(key: string): Item {
						return memcache[key];
					}
					put(key: string, item: Item): Item {
						return memcache[key] = item;
					}
					remove(key: string): void {
						delete memcache[key];
					}
					clear(): void {
						memcache = {};
					}
				}

				cache = new MockCache();
				const potion = new Potion({cache});

				potion.register('/user', User);
				potion.register('/car', Car);
				potion.register('/engine', Engine);
				potion.register('/person', Person);

				spyOn(potion, 'fetch').and.callThrough();
				spyOn(cache, 'get').and.callThrough();
			});

			afterEach(() => {
				cache.clear();
			});

			it('should correctly deserialize Potion server response', (done) => {
				Promise.all([User.fetch(1), User.fetch('00cc8d4b-9682-4655-ad78-1fa4b03e757d')]).then(([user1, user2]: User[]) => {
					expect(user1.id).toEqual(1);
					expect(user1.createdAt instanceof Date).toBe(true);
					expect(user2.id).toEqual('00cc8d4b-9682-4655-ad78-1fa4b03e757d');
					expect(user2.createdAt instanceof Date).toBe(true);
					done();
				});
			});

			it('should always cache the Item(s)', (done) => {
				User.fetch(1).then(() => {
					expect(cache.get('/user/1')).not.toBeUndefined();
					done();
				});
			});

			it('should automatically resolve references', (done) => {
				Car.fetch(1).then((car: Car) => {
					expect(car.user instanceof (User as any)).toBe(true);
					expect(car.user.id).toEqual(1);
					done();
				});
			});

			it('should work with cross-references', (done) => {
				Person.fetch(1).then((person: Person) => {
					expect(person.sibling instanceof (Person as any)).toBe(true);
					done();
				});
			});

			it('should return the original request response for {$schema} references', (done) => {
				User.schema().then((json) => {
					expect(json).toEqual(deepOmap(schema, null, (key) => toCamelCase(key)));
					done();
				});
			});

			// TODO: this may behave different at some point,
			// but for now we need to test the lib works properly when such values are parsed.
			it('should skip {$ref: "#"} references', (done) => {
				Engine.fetch(1).then((engine: Engine) => {
					expect(engine.car).toEqual('#');
					done();
				});
			});
		});
	});
});
