/* tslint:disable:max-file-line-count max-classes-per-file no-magic-numbers */

import {readonly} from './metadata';
import {PotionBase, RequestOptions, ItemCache} from './potion';
import {Item} from './item';
import {Pagination} from './pagination';


describe('potion/core', () => {
	describe('Item()', () => {
		it('should be an instance of Item', () => {
			class User extends Item {}
			const user = new User();
			expect(user instanceof (Item as any)).toBe(true);
		});

		it('should be an instance of the child class that extended it', () => {
			class User extends Item {}
			const user = new User();
			expect(user instanceof (User as any)).toBe(true);
		});

		it('should have the same attributes it was initialized with', () => {
			class User extends Item {
				name: string;
				weight: number;
				age: number;
			}
			const user = new User({name: 'John Doe', age: 24, weight: 72});
			expect(user.name).toEqual('John Doe');
			expect(user.age).toEqual(24);
			expect(user.weight).toEqual(72);
		});

		describe('.update()', () => {
			class User extends Item {
				name: string;
			}

			beforeEach(() => {
				const JOHN = {
					$uri: '/user/1',
					name: 'John Doe'
				};

				class Potion extends PotionBase {
					protected request(uri: string, options?: RequestOptions): Promise<any> {
						const {promise} = this.constructor as typeof PotionBase;
						options = options || ({} as RequestOptions);

						switch (uri) {
							case '/user/1':
								if (options.method === 'PATCH') {
									Object.assign(JOHN, {}, options.data);
								}

								return promise.resolve({data: JOHN});
							default:
								break;
						}

						return promise.resolve({});
					}
				}

				const potion = new Potion();
				potion.register('/user', User);
			});

			it('should update the Item', (done) => {
				User.fetch(1).then((user: User) => {
					expect(user.name).toEqual('John Doe');
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

		describe('.destroy()', () => {
			class User extends Item {
				name: string;
			}

			beforeEach(() => {
				let john: any = {
					$uri: '/user/1',
					name: 'John Doe'
				};

				class Potion extends PotionBase {
					protected request(_: string, options?: RequestOptions): Promise<any> {
						const {promise} = this.constructor as typeof PotionBase;
						options = options || ({} as RequestOptions);

						switch (options.method) {
							case 'GET':
								if (john) {
									return promise.resolve({data: john});
								}
								return promise.reject();
							case 'DELETE':
								john = null;
								return promise.resolve({});
							default:
								break;
						}

						return promise.resolve({});
					}
				}

				const potion = new Potion();
				potion.register('/user', User);
			});

			it('should destroy the Item', (done) => {
				const success = jasmine.createSpy('success');
				const error = jasmine.createSpy('error');

				User.fetch(3).then((user: User) => {
					user.destroy().then(() => {
						User.fetch(3).then(success, error);
						setTimeout(
							() => {
								expect(success).not.toHaveBeenCalled();
								expect(error).toHaveBeenCalled();
								done();
							},
							50
						);
					});
				});
			});
		});

		describe('.save()', () => {
			class User extends Item {
				name: string;
			}

			beforeEach(() => {
				let john = null;

				class Potion extends PotionBase {
					protected request(_: string, options?: RequestOptions): Promise<any> {
						const {promise} = this.constructor as typeof PotionBase;
						options = options || ({} as RequestOptions);

						switch (options.method) {
							case 'POST':
								return promise.resolve(john = Object.assign({}, options.data, {$uri: '/user/4'}));
							case 'GET':
								return promise.resolve({data: john});
							default:
								break;
						}

						return promise.resolve({});
					}
				}

				const potion = new Potion();
				potion.register('/user', User);
			});

			it('should save the Item', (done) => {
				const name = 'Foo Bar';
				const user = new User({name});

				user.save().then(() => {
					User.fetch(4).then((user: User) => {
						expect(user.id).toEqual(4);
						expect(user.name).toEqual(name);
						done();
					});
				});
			});
		});

		describe('.toJSON()', () => {
			class User extends Item {
				name: string;
				weight: number;

				@readonly
				age: number;
			}

			let user: User;

			beforeEach(() => {
				class Potion extends PotionBase {
					protected request(): Promise<any> {
						const {promise} = this.constructor as typeof PotionBase;
						return promise.resolve({});
					}
				}

				const potion = new Potion();
				potion.register('/user', User, {
					readonly: ['weight']
				});

				user = new User({name: 'John Doe', age: 24, weight: 72});
			});

			it('should return a JSON repr. of the Item without the "id"', () => {
				const {name, id} = user.toJSON();
				expect(name).toEqual('John Doe');
				expect(id).toBeUndefined();
			});

			it('should omit @readonly properties', () => {
				const {age, weight} = user.toJSON();
				expect(age).toBeUndefined();
				expect(weight).toBeUndefined();
			});
		});
	});

	describe('Item.fetch()', () => {
		let potion;
		let cache;
		let memcache = {};

		class User extends Item {}

		beforeEach(() => {
			class Potion extends PotionBase {
				protected request(uri: string): Promise<any> {
					const {promise} = this.constructor as typeof PotionBase;

					switch (uri) {
						case '/user/1':
							return promise.resolve({
								data: {
									$uri: '/user/1',
									created_at: {
										$date: 1451060269000
									}
								}
							});
						default:
							break;
					}

					return promise.resolve({});
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
			potion = new Potion({cache});

			potion.register('/user', User);

			spyOn(potion, 'request').and.callThrough();
			spyOn(cache, 'get').and.callThrough();
		});

		afterEach(() => {
			cache.clear();
		});

		it('should return an instance of Item', (done) => {
			User.fetch(1).then((user: User) => {
				expect(user instanceof (User as any)).toBe(true);
				done();
			});
		});

		it('should not trigger more requests for consequent requests for the same resource and if the first request is still pending', (done) => {
			Promise.all([User.fetch(1, {cache: false}), User.fetch(1, {cache: false})]).then(() => {
				expect(potion.request).toHaveBeenCalledTimes(1);
				done();
			});
		});

		it('should skip retrieval from Item cache if {cache} option is set to false', (done) => {
			User.fetch(1, {cache: false}).then(() => {
				// `cache.get()` will be called twice during deserialization in Potion()._fromPotionJSON()
				expect(cache.get).toHaveBeenCalledTimes(2);
				expect(cache.get('/user/1')).toBeDefined();
				done();
			});
		});
	});

	describe('Item.query()', () => {
		let potion;

		class User extends Item {}

		// Cross reference mock classes
		class Person extends Item {
			groups: Group[];
		}
		class Group extends Item {
			members: Person[];
		}

		// Back references mock classes
		class M1 extends Item {
			m2: M2;
		}
		class M2 extends Item {
			m3: M3;
			m1s: M1[];
		}
		class M3 extends Item {
			m4: M4;
			m2s: M2[];
		}
		class M4 extends Item {
			m3s: M3[];
		}

		beforeEach(() => {
			class Potion extends PotionBase {
				protected request(uri: string, options?: RequestOptions): Promise<any> {
					const {promise} = this.constructor as typeof PotionBase;

					switch (uri) {
						case '/user':
							return buildQueryResponse(
								[
									{$ref: '/user/1'},
									{$ref: '/user/2'}
								],
								options,
								promise
							);
						case '/person':
							return buildQueryResponse(
								[
									{$ref: '/person/1'},
									{$ref: '/person/2'}
								],
								options,
								promise
							);
						case '/group':
							return buildQueryResponse(
								[
									{$ref: '/group/1'},
									{$ref: '/group/2'}
								],
								options,
								promise
							);
						case '/user/1':
							return promise.resolve({
								data: {
									$uri: '/user/1'
								}
							});
						case '/user/2':
							return promise.resolve({
								data: {
									$uri: '/user/2'
								}
							});
						case '/person/1':
							return promise.resolve({
								data: {
									$uri: '/person/1',
									groups: [
										{$ref: '/group/1'},
										{$ref: '/group/2'}
									]
								}
							});
						case '/person/2':
							return promise.resolve({
								data: {
									$uri: '/person/2',
									groups: [
										{$ref: '/group/1'},
										{$ref: '/group/2'}
									]
								}
							});
						case '/group/1':
							return promise.resolve({
								data: {
									$uri: '/group/1',
									members: [
										{$ref: '/person/1'},
										{$ref: '/person/2'}
									]
								}
							});
						case '/group/2':
							return promise.resolve({
								data: {
									$uri: '/group/2',
									members: [
										{$ref: '/person/1'},
										{$ref: '/person/2'}
									]
								}
							});

						// Circular dependency mock data
						case '/m1':
							return buildQueryResponse([{$ref: '/m1/1'}, {$ref: '/m1/2'}, {$ref: '/m1/3'}], options, promise);
						case '/m1/1':
							return promise.resolve({data: {$uri: '/m1/1', m2: {$ref: '/m2/1'}}});
						case '/m1/2':
							// Simulate latency
							return new promise((resolve) => {
								setTimeout(() => {
									resolve({data: {$uri: '/m1/2', m2: {$ref: '/m2/1'}}})
								}, 500);
							});
						case '/m1/3':
							return promise.resolve({data: {$uri: '/m1/3', m2: {$ref: '/m2/2'}}});
						case '/m2/1':
							return promise.resolve({data: {$uri: '/m2/1', m1s: [{$ref: '/m1/1'}, {$ref: '/m1/2'}], m3: {$ref: '/m3/1'}}});
						case '/m2/2':
							// Simulate latency
							return new promise((resolve) => {
								setTimeout(() => {
									resolve({data: {$uri: '/m2/2', m1s: [{$ref: '/m1/3'}], m3: {$ref: '/m3/1'}}});
								}, 250)
							});
						case '/m2/3':
							return promise.resolve({data: {$uri: '/m2/3', m1s: [], m3: {$ref: '/m3/2'}}});
						case '/m3/1':
							// Simulate latency
							return new promise((resolve) => {
								setTimeout(() => {
									resolve({data: {$uri: '/m3/1', m2s: [{$ref: '/m2/1'}, {$ref: '/m2/2'}], m4: {$ref: '/m4/1'}}})
								}, 500);
							});
						case '/m3/2':
							return promise.resolve({data: {$uri: '/m3/2', m2s: [{$ref: '/m2/3'}], m4: {$ref: '/m4/1'}}});
						case '/m4/1':
							// Simulate latency
							return new promise((resolve) => {
								setTimeout(() => {
									resolve({data: {$uri: '/m4/1', m3s: [{$ref: '/m3/1'}, {$ref: '/m3/2'}]}})
								}, 250);
							});

						default:
							break;
					}

					return promise.resolve({});
				}
			}

			const memcache = new Map();
			class MockCache implements ItemCache<Item> {
				get(key: string): Item {
					return memcache.get(key);
				}
				put(key: string, item: Item): Item {
					memcache.set(key, item);
					return item;
				}
				remove(key: string): void {
					memcache.delete(key);
				}
			}

			potion = new Potion({cache: new MockCache()});

			potion.register('/user', User);
			potion.register('/person', Person);
			potion.register('/group', Group);

			potion.register('/m1', M1);
			potion.register('/m2', M2);
			potion.register('/m3', M3);
			potion.register('/m4', M4);

			function buildQueryResponse(data: any, options: any, promise: any): Promise<any> {
				/* tslint:disable: variable-name */
				const {page, per_page} = options.search;
				/* tslint:enable: variable-name */

				const response = {data};

				if (page && per_page) {
					Object.assign(response, {
						data: toPages(response.data, per_page)[page - 1], // If pagination params are sent, return the appropriate page
						headers: {
							'x-total-count': 2
						}
					});
				}

				return promise.resolve(response);
			}
		});

		it('should return a Pagination object', (done) => {
			User.query({}, {paginate: true}).then((users: Pagination<User>) => {
				expect(users instanceof Pagination).toBe(true);
				expect(users.length).toEqual(2);
				expect(users.page).toEqual(1);
				expect(users.perPage).toEqual(25); // Default value if not set with options
				expect(users.pages).toEqual(1);
				expect(users.total).toEqual(2);
				done();
			});
		});

		it('should contain instances of an Item', (done) => {
			User.query({}, {paginate: true}).then((users: Pagination<User>) => {
				for (const user of users) {
					expect(user instanceof (User as any)).toBe(true);
				}
				done();
			});
		});

		it('should return the right page when called with pagination params ({page, perPage})', (done) => {
			User.query({page: 2, perPage: 1}, {paginate: true}).then((users: Pagination<User>) => {
				expect(users.length).toEqual(1);
				expect(users.page).toEqual(2);
				expect(users.perPage).toEqual(1);
				expect(users.pages).toEqual(2);
				expect(users.total).toEqual(2);
				expect(users.toArray()[0].id).toEqual(2); // Jane
				done();
			});
		});

		it('should update query if {page} is set on the pagination object', (done) => {
			User.query({page: 2, perPage: 1}, {paginate: true}).then((users: Pagination<User>) => {
				users.changePageTo(1).then(() => {
					expect(users.page).toEqual(1);
					expect(users.toArray()[0].id).toEqual(1); // John
					done();
				});
			});
		});

		it('should work with cross-references', (done) => {
			Person.query(undefined, {paginate: true}).then((people: Person[]) => {
				expect(people.length).toEqual(2);
				for (const person of people) {
					expect(person.groups.length).toEqual(2);
					for (const group of person.groups) {
						expect(group instanceof (Group as any)).toBe(true);
						expect(group.members.length).toEqual(2);
						for (const member of group.members) {
							expect(member instanceof (Person as any)).toBe(true);
						}
					}
				}
				done();
			});
		});

		it('should work with back references', (done) => {
			M1.query({})
				.then((m1s: M1[]) => {
					expect(m1s.length).toEqual(3);
					m1s.forEach((m1) => expect(m1 instanceof M1).toBeTruthy());

					const m4s = m1s.map(({m2}) => m2)
						.map(({m3}) => m3)
						.map(({m4}) => m4);

					m4s.forEach((m4) => expect(m4 instanceof M4).toBeTruthy());

					done();
				});
		});
	});

	describe('Item.first()', () => {
		let potion;

		class User extends Item {}

		beforeEach(() => {
			class Potion extends PotionBase {
				protected request(uri: string, options?: RequestOptions): Promise<any> {
					const{promise} = this.constructor as typeof PotionBase;
					options = options || ({} as RequestOptions);

					switch (uri) {
						case '/user':
							/* tslint:disable: variable-name */
							const {page, per_page} = options.search || {page: 1, per_page: 25};
							/* tslint:enable: variable-name */

							const response = {data: [{$ref: '/user/1'}, {$ref: '/user/2'}]};

							if (page && per_page) {
								Object.assign(response, {
									data: toPages(response.data, per_page)[page - 1], // If pagination params are sent, return the appropriate page
									headers: {
										'x-total-count': 2
									}
								});
							}

							return promise.resolve(response);
						case '/user/1':
							return promise.resolve({
								data: {
									$uri: '/user/1'
								}
							});
						case '/user/2':
							return promise.resolve({
								data: {
									$uri: '/user/2'
								}
							});
						default:
							break;
					}

					return promise.resolve({});
				}
			}

			potion = new Potion();
			potion.register('/user', User);
		});

		it('should return the fist Item', (done) => {
			User.first().then((user: User) => {
				expect(user instanceof (User as any)).toBe(true);
				done();
			});
		});
	});
});


function toPages(items: any[], perPage: number): any[][] {
	let i;
	let j;
	const pages: any[][] = [];

	for (i = 0, j = items.length; i < j; i += perPage) {
		pages.push(items.slice(i, i + perPage));
	}

	return pages;
}
