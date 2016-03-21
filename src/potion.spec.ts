import {
	PotionBase,
	Item
} from "./potion";


describe('potion', () => {
	let potion;
	let user;

	beforeEach(() => {
		potion = Potion.create({prefix: '/api'});
		user = User.create({name: 'John Doe'});
	});
	afterEach(() => {
		potion = null;
		user = null;
	});

	describe('Potion.create()', () => {
		it('should add new resources via .registerAs() decorator', () => {
			@potion.registerAs('/person')
			class Person extends Item {
			}

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

		it('should return a JSON repr. of itself via .toJSON() method', () => {
			expect(user.toJSON()).toEqual({
				name: 'John Doe'
			});
		});
	});

	describe('Item.fetch()', () => {
		it('should convert snake case keys to camel case keys', (done) => {
			User.fetch(1).then((user: User) => {
				expect(user.camelCase).not.toBeUndefined();
				done();
			});
		});
	});
});


export class Potion extends PotionBase {
	constructor(options?) {
		super(Object.assign({prefix: '/api', options}));
	}

	fetch(uri, {method} = {method: 'GET'}): Promise<any> {
		return Promise.resolve({camel_case: true});
	}
}

class User extends Item {
	name: string;
	camelCase: any;
}
