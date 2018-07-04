// tslint:disable: max-classes-per-file
import {Item} from './item';
import {Pagination} from './pagination';
import {PotionBase} from './potion';


describe('potion/core', () => {
    describe('pagination.ts', () => {
        describe('Pagination', () => {
            let potion: Potion;
            let uri: string;
            let items: Foo[];
            let options;
            let pagination: Pagination<Foo>;

            beforeEach(() => {
                potion = new Potion();
                uri = '/foo';
                items = Array(25)
                    .fill(1)
                    .map((e, i) => i + e)
                    .map(id => {
                        const foo = new Foo();
                        Object.assign(foo, {
                            $id: id,
                            $uri: `/foo/${id}`
                        });
                        return foo;
                    });
                options = {};

                pagination = new Pagination({potion, uri}, items, '100', options);
                Object.assign(options, {pagination});
            });

            it('should be interable', () => {
                const spy = jasmine.createSpy('for ... of pagination');
                for (const foo of pagination) {
                    expect(foo instanceof Foo).toBe(true);
                    spy(foo);
                }
                expect(spy).toHaveBeenCalledTimes(25);
            });

            describe('.at()', () => {
                it('should get the item at a certain index', () => {
                    const first = pagination.at(0);
                    const last = pagination.at(pagination.length - 1);
                    expect(first instanceof Foo).toBe(true);
                    expect(last instanceof Foo).toBe(true);
                });
            });

            describe('.toArray()', () => {
                it('should convert the pagination into an Array', () => {
                    const spy = jasmine.createSpy('for ... of items');
                    const items = pagination.toArray()
                        .slice(0);

                    expect(items.length).toEqual(25);

                    for (const foo of items) {
                        expect(foo instanceof Foo).toBe(true);
                        spy(foo);
                    }

                    expect(spy).toHaveBeenCalledTimes(25);
                });
            });
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
