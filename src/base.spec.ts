import {
	PotionBase,
	Item,
	readonly
} from './base';


describe('potion', () => {
	let potion;
	let user;

	beforeEach(() => {
		potion = new Potion({prefix: '/api'});
		user = User.create({name: 'John Doe', age: 24, weight: 72}, {
			readonly: ['weight']
		});
	});
	afterEach(() => {
		potion = null;
		user = null;
	});

	describe('new Potion()', () => {
		it('should add new resources via .registerAs() decorator', () => {
			@potion.registerAs('/person')
			class Person extends Item {}

			expect(Object.keys(potion.resources).length).toEqual(1);
			expect(potion.resources['/person']).not.toBeUndefined();
		});

		it('should add new resources via .register() method', () => {
			potion.register('/user', User);

			expect(Object.keys(potion.resources).length).toEqual(1);
			expect(potion.resources['/user']).not.toBeUndefined();
		});
	});

	describe('Item.create()', () => {
		it('should create an instance of Item', () => {
			expect(user.id).toEqual(null);
		});

		it('should be an instance of the child class that extended it', () => {
			expect(user instanceof User).toBe(true);
		});

		it('should have the same attributes it was initialized with', () => {
			expect(user.name).toEqual('John Doe');
		});
	});

	describe('Item instance', () => {
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
	constructor(options?) {
		super(Object.assign({prefix: '/api', options}));
	}

	request(uri): Promise<any> {
		return (<typeof PotionBase>this.constructor).promise.resolve({camel_case: true});
	}
}

class User extends Item {
	name: string;

	@readonly
	age: number;
}
