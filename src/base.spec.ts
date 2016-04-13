import {
	PotionBase,
	PotionItemCache,
	Item,
	readonly,
	Route
} from './base';


describe('potion/base', () => {
	describe('Potion()', () => {
		let potion;

		beforeEach(() => {
			class Potion extends PotionBase {
				request(uri): Promise<any> {
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
	});

	describe('Item()', () => {
		let user;
		class User extends Item {
			name: string;
			weight: number;

			@readonly
			age: number;
		}

		beforeEach(() => {
			user = new User({name: 'John Doe', age: 24, weight: 72}, {
				readonly: ['weight']
			});
		});

		afterEach(() => {
			user = null;
		});

		it('should create an instance of Item', () => {
			expect(user.id).toEqual(null);
		});

		it('should be an instance of the child class that extended it', () => {
			expect(user instanceof User).toBe(true);
		});

		it('should have the same attributes it was initialized with', () => {
			expect(user.name).toEqual('John Doe');
			expect(user.age).toEqual(24);
			expect(user.weight).toEqual(72);
		});

		describe('.toJSON()', () => {
			it('should return a JSON repr. of the Item', () => {
				let {name, id} = user.toJSON();
				expect(name).toEqual('John Doe');
				expect(id).toEqual(null);
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

		class User extends Item {
			name: string;
			createdAt: Date;
		}

		beforeEach(() => {
			class Potion extends PotionBase {
				request(uri): Promise<any> {
					return (<typeof PotionBase>this.constructor).promise.resolve({
						data: {
							$uri: '/user/1',
							created_at: {
								$date: 1451060269000
							}
						},
						headers: {}
					});
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

			spyOn(potion, 'request').and.callThrough();
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

		it('should not trigger more requests for consequent requests for the same resource and if the first request is still pending', (done) => {
			Promise.all([User.fetch(1, {cache: false}), User.fetch(1, {cache: false})]).then(() => {
				expect(potion.request).toHaveBeenCalledTimes(1);
				done();
			});
		});

		it('should always cache the Item(s)', (done) => {
			User.fetch(1).then(() => {
				expect(cache.get('/user/1')).not.toBeUndefined();
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

	describe('Route', () => {
		class User extends Item {
			static names = Route.GET<string[]>('/names');
			attributes = Route.GET<{height: number, weight: number}>('/attributes');
		}

		beforeEach(() => {
			class Potion extends PotionBase {
				request(uri): Promise<any> {
					switch (uri) {
						case '/api/user/1':
							return (<typeof PotionBase>this.constructor).promise.resolve({data: {$uri: '/user/1'}});
						case '/api/user/names':
							return (<typeof PotionBase>this.constructor).promise.resolve({
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
