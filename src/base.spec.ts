import {
	PotionItemCache,
	RequestOptions,
	PotionBase,
	Pagination,
	Item,
	readonly,
	Route
} from './base';


describe('potion/base', () => {
	describe('Potion()', () => {
		let potion;

		beforeEach(() => {
			class Potion extends PotionBase {
				protected _fetch(uri): Promise<any> {
					return (<typeof PotionBase>this.constructor).promise.resolve({});
				}
			}

			potion = new Potion({prefix: '/api', cache: null});
		});

		afterEach(() => {
			potion = null;
		});

		it('should have {prefix, cache} configurable properties', () => {
			expect(potion.prefix).toEqual('/api');
			expect(potion.cache).toBe(null);
		});

		describe('.register()', () => {
			it('should add new resources', () => {
				class User extends Item {}

				potion.register('/user', User);

				expect(Object.keys(potion.resources).length).toEqual(1);
				expect(potion.resources['/user']).not.toBeUndefined();
			});
		});

		describe('.registerAs()', () => {
			it('should add new resources', () => {
				@potion.registerAs('/user')
				class User extends Item {}

				expect(Object.keys(potion.resources).length).toEqual(1);
				expect(potion.resources['/user']).not.toBeUndefined();
			});
		});

		describe('.fetch()', () => {
			it('should correctly serialize {data, search} params when making a request', (done) => {
				let search: any;
				let data: any;

				class Potion extends PotionBase {
					protected _fetch(uri, options: RequestOptions): Promise<any> {
						data = options.data;
						search = options.search;

						return (<typeof PotionBase>this.constructor).promise.resolve({});
					}
				}

				let potion = new Potion();
				let today = new Date();

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

			class User extends Item {
				createdAt: Date;
			}

			class Car extends Item {
				user: User;
			}

			beforeEach(() => {
				class Potion extends PotionBase {
					protected _fetch(uri): Promise<any> {
						let {promise} = (<typeof PotionBase>this.constructor);

						switch (uri) {
							case '/api/user/1':
								return promise.resolve({
									data: {
										$uri: '/user/1',
										created_at: {
											$date: 1451060269000
										}
									}
								});
							case '/api/car/1':
								return promise.resolve({
									data: {
										$uri: '/car/1',
										user: {$ref: '/user/1'}
									},
									headers: {}
								});
							default:
								break;
						}
					}
				}

				class MockCache implements PotionItemCache<Item> {
					get(key: string): Item {
						return memcache[key];
					}
					put(key: string, item: Item): Item {
						return memcache[key] = item;
					}
					remove(key: string) {
						delete memcache[key];
					}
					clear() {
						memcache = {};
					}
				}

				cache = new MockCache();
				let potion = new Potion({cache, prefix: '/api'});

				potion.register('/user', User);
				potion.register('/car', Car);

				spyOn(potion, 'fetch').and.callThrough();
				spyOn(cache, 'get').and.callThrough();
			});

			afterEach(() => {
				cache.clear();
			});

			it('should correctly deserialize Potion server response', (done) => {
				User.fetch(1).then((user: User) => {
					expect(user.id).toEqual(1);
					expect(user.createdAt instanceof Date).toBe(true);
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
					expect(car.user instanceof User).toBe(true);
					expect(car.user.id).toEqual(1);
					done();
				});
			});
		});
	});

	describe('Item()', () => {
		it('should be an instance of the child class that extended it', () => {
			class User extends Item {}
			let user = new User();
			expect(user instanceof User).toBe(true);
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
					protected _fetch(uri, options?: RequestOptions): Promise<any> {
						let {promise} = (<typeof PotionBase>this.constructor);

						switch (uri) {
							case '/api/user/1':
								if (options.method === 'PATCH') {
									Object.assign(JOHN, {}, options.data);
								}

								return promise.resolve({data: JOHN});
							default:
								break;
						}
					}
				}

				let potion = new Potion({prefix: '/api'});
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
				let john = {
					$uri: '/user/1',
					name: 'John Doe'
				};

				class Potion extends PotionBase {
					protected _fetch(uri, options?: RequestOptions): Promise<any> {
						let {promise} = (<typeof PotionBase>this.constructor);

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
					}
				}

				let potion = new Potion({prefix: '/api'});
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
					protected _fetch(uri, options?: RequestOptions): Promise<any> {
						let {promise} = (<typeof PotionBase>this.constructor);

						switch (options.method) {
							case 'POST':
								return promise.resolve(john = Object.assign({}, options.data, {$uri: '/user/4'}));
							case 'GET':
								return promise.resolve({data: john});
							default:
								break;
						}
					}
				}

				let potion = new Potion({prefix: '/api'});
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
					protected _fetch(uri, options?: RequestOptions): Promise<any> {
						let {promise} = (<typeof PotionBase>this.constructor);
						return promise.resolve({});
					}
				}

				let potion = new Potion({prefix: '/api'});
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
				protected _fetch(uri): Promise<any> {
					let {promise} = (<typeof PotionBase>this.constructor);

					switch (uri) {
						case '/api/user/1':
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
				}
			}

			class MockCache implements PotionItemCache<Item> {
				get(key: string): Item {
					return memcache[key];
				}
				put(key: string, item: Item): Item {
					return memcache[key] = item;
				}
				remove(key: string) {
					delete memcache[key];
				}
				clear() {
					memcache = {};
				}
			}

			cache = new MockCache();
			potion = new Potion({cache, prefix: '/api'});

			potion.register('/user', User);

			spyOn(potion, 'fetch').and.callThrough();
			spyOn(cache, 'get').and.callThrough();
		});

		afterEach(() => {
			cache.clear();
		});

		it('should return an instance of Item', (done) => {
			User.fetch(1).then((user: User) => {
				expect(user instanceof User).toBe(true);
				done();
			});
		});

		it('should not trigger more requests for consequent requests for the same resource and if the first request is still pending', (done) => {
			Promise.all([User.fetch(1, {cache: false}), User.fetch(1, {cache: false})]).then(() => {
				expect(potion.fetch).toHaveBeenCalledTimes(1);
				done();
			});
		});

		it('should skip retrieval from Item cache if {cache} option is set to false', (done) => {
			User.fetch(1, {cache: false}).then((user) => {
				expect(cache.get).not.toHaveBeenCalled();
				expect(cache.get('/user/1')).not.toBeUndefined();
				done();
			});
		});
	});

	describe('Item.query()', () => {
		let potion;

		class User extends Item {}

		beforeEach(() => {
			class Potion extends PotionBase {
				protected _fetch(uri, options?: RequestOptions): Promise<any> {
					let {promise} = (<typeof PotionBase>this.constructor);

					switch (uri) {
						case '/api/user':
							/* tslint:disable: variable-name */
							let {page, per_page} = options.search;
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
						case '/api/user/1':
							return promise.resolve({
								data: {
									$uri: '/user/1'
								}
							});
						case '/api/user/2':
							return promise.resolve({
								data: {
									$uri: '/user/2'
								}
							});
						default:
							break;
					}
				}
			}

			function toPages(items: any[], perPage: number): Array<any[]> {
				let i;
				let j;
				let pages = [];

				for (i = 0, j = items.length; i < j; i += perPage) {
					pages.push(items.slice(i, i + perPage));
				}

				return pages;
			}

			potion = new Potion({prefix: '/api'});

			potion.register('/user', User);
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
					expect(user instanceof User).toBe(true);
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
	});

	describe('Route', () => {
		class User extends Item {
			static names = Route.GET<string[]>('/names');
			attributes = Route.GET<{height: number, weight: number}>('/attributes');
		}

		beforeEach(() => {
			class Potion extends PotionBase {
				protected _fetch(uri): Promise<any> {
					let {promise} = (<typeof PotionBase>this.constructor);

					switch (uri) {
						case '/api/user/1':
							return promise.resolve({data: {$uri: '/user/1'}});
						case '/api/user/names':
							return promise.resolve({
								data: ['John Doe'],
								headers: {}
							});
						default:
							break;
					}
				}
			}

			let potion = new Potion({prefix: '/api'});
			potion.register('/user', User);

		});

		it('should allow for usage as instance property', (done) => {
			User.fetch(1).then((user: User) => {
				expect(typeof user.attributes === 'function').toBe(true);
				done();
			});
		});

		it('should allow for usage as static property', () => {
			expect(typeof User.names === 'function').toBe(true);
		});

		describe('.GET()', () => {
			it('should return valid JSON', (done) => {
				User.names().then((names: any) => {
					expect(names instanceof Array).toBe(true);
					expect(names.length).toEqual(1);
					done();
				});
			});
		});
	});
});
