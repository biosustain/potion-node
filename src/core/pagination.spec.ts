// tslint:disable: max-classes-per-file
import {Item} from './item';
import {Pagination} from './pagination';
import {PotionBase} from './potion';


describe('potion/core', () => {
	describe('Pagination', () => {
		it('should work with .slice()', () => {
			const potion = new Potion();
			const uri = '/foo';
			const items = Array(100)
				.fill(1)
				.map((e, i) => i + e)
				.map((id) => {
					const foo = new Foo();
					Object.assign(foo, {
						$id: id,
						$uri: `/foo/${id}`
					});
					return foo;
				});
			const options = {};

			const pagination = new Pagination({potion, uri}, items, '1', options);
			Object.assign(options, {pagination});

			const spy = jasmine.createSpy('pagination.slice()');

			try {
				pagination.slice(0);
			} catch (e) {
				console.log(e)
				spy(e);
			}

			expect(spy).not.toHaveBeenCalled();
		});
	});
});


class Potion extends PotionBase {
	// tslint:disable-next-line: prefer-function-over-method
	protected request(): Promise<any> {
		return Promise.resolve({});
	}
}

class Foo extends Item {

}
