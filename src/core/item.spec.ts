/* tslint:disable:max-file-line-count */

import {readonly} from './metadata';
import {PotionBase, RequestOptions, ItemCache} from './potion';
import {Item} from './item';
import {Pagination} from './pagination';


describe('potion/core', () => {
	describe('Item()', () => {
		it('should be an instance of Item', () => {
			class User extends Item {}
			let user = new User();
			expect(user instanceof (Item as any)).toBe(true);
		});

		it('should be an instance of the child class that extended it', () => {
			class User extends Item {}
			let user = new User();
			expect(user instanceof (User as any)).toBe(true);
		});

		it('should have the same attributes it was initialized with', () => {
			class User extends Item {
				name: string;
				weight: number;
				age: number;
			}
			let user = new User({name: 'John Doe', age: 24, weight: 72});
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
						let {promise} = this.constructor as typeof PotionBase;
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

				let potion = new Potion();
				potion.register('/user', User);
			});

			it('should update the Item', (done) => {
				User.fetch(1).then((user: User) => {
					expect(user.name).toEqual('John Doe');
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
						let {promise} = this.constructor as typeof PotionBase;
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

				let potion = new Potion();
				potion.register('/user', User);
			});

			it('should destroy the Item', (done) => {
				let success = jasmine.createSpy('success');
				let error = jasmine.createSpy('error');

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
						let {promise} = this.constructor as typeof PotionBase;
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

				let potion = new Potion();
				potion.register('/user', User);
			});

			it('should save the Item', (done) => {
				let name = 'Foo Bar';
				let user = new User({name});

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
						let {promise} = this.constructor as typeof PotionBase;
						return promise.resolve({});
					}
				}

				let potion = new Potion();
				potion.register('/user', User, {
					readonly: ['weight']
				});

				user = new User({name: 'John Doe', age: 24, weight: 72});
			});

			it('should return a JSON repr. of the Item without the "id"', () => {
				let {name, id} = user.toJSON();
				expect(name).toEqual('John Doe');
				expect(id).toBeUndefined();
			});

			it('should omit @readonly properties', () => {
				let {age, weight} = user.toJSON();
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
					let {promise} = this.constructor as typeof PotionBase;

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

		class Person extends Item {
			groups: Group[];
		}

		class Group extends Item {
			members: Person[];
		}

		beforeEach(() => {
			class Potion extends PotionBase {
				protected request(uri: string, options?: RequestOptions): Promise<any> {
					let {promise} = this.constructor as typeof PotionBase;

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
						default:
							break;
					}

					return promise.resolve({});
				}
			}

			let memcache = new Map();
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

			function buildQueryResponse(data: any, options: any, promise: any): Promise<any> {
				/* tslint:disable: variable-name */
				let {page, per_page} = options.search;
				/* tslint:enable: variable-name */

				let response = {data};

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
				for (let user of users) {
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
				for (let person of people) {
					expect(person.groups.length).toEqual(2);
					for (let group of person.groups) {
						expect(group instanceof (Group as any)).toBe(true);
						expect(group.members.length).toEqual(2);
						for (let member of group.members) {
							expect(member instanceof (Person as any)).toBe(true);
						}
					}
				}
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
					let {promise} = this.constructor as typeof PotionBase;
					options = options || ({} as RequestOptions);

					switch (uri) {
						case '/user':
							/* tslint:disable: variable-name */
							let {page, per_page} = options.search || {page: 1, per_page: 25};
							/* tslint:enable: variable-name */

							let response = {data: [{$ref: '/user/1'}, {$ref: '/user/2'}]};

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


function toPages(items: any[], perPage: number): Array<any[]> {
	let i;
	let j;
	let pages: any[][] = [];

	for (i = 0, j = items.length; i < j; i += perPage) {
		pages.push(items.slice(i, i + perPage));
	}

	return pages;
}
