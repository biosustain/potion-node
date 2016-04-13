import {
	PotionBase,
	PotionItemCache,
	Item,
	readonly
} from './base';


describe('potion', () => {
	describe('Potion()', () => {
		let potion;

		beforeEach(() => {
			potion = new Potion({prefix: '/api', cache: new MockCache()});
		});

		afterEach(() => {
			potion = null;
		});

		it('should have {prefix, cache} configurable properties', () => {
			expect(potion.prefix).toEqual('/api');
			expect(potion.cache instanceof MockCache).toBe(true);
		});

		describe('.register()', () => {
			it('should add new resources', () => {
				potion.register('/user', User);

				expect(Object.keys(potion.resources).length).toEqual(1);
				expect(potion.resources['/user']).not.toBeUndefined();
			});
		});

		describe('.registerAs()', () => {
			it('should add new resources', () => {
				@potion.registerAs('/person')
				class Person extends Item {}

				expect(Object.keys(potion.resources).length).toEqual(1);
				expect(potion.resources['/person']).not.toBeUndefined();
			});
		});
	});

	describe('Item()', () => {
		let user;

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
		});

		describe('.toJSON()', () => {
			it('should return a JSON repr. of the Item', () => {
				expect(user.toJSON()).toEqual({
					id: null,
					name: 'John Doe'
				});
			});

			it('should omit @readonly properties', () => {
				expect(user.toJSON()).toEqual({
					id: null,
					name: 'John Doe'
				});
			});
		});
	});
});


export class Potion extends PotionBase {
	request(uri): Promise<any> {
		return (<typeof PotionBase>this.constructor).promise.resolve({camel_case: true});
	}
}

class MockCache implements PotionItemCache<Item> {
	get(key: string): any {};
	put(key: string, item: Item): any {};
	remove(key: string) {};
}

class User extends Item {
	name: string;

	@readonly
	age: number;
}
