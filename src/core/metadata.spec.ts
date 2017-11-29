// tslint:disable: max-classes-per-file no-empty
import {
    async,
    getPotionInstance,
    getPotionPromiseCtor,
    getPotionURI,
    isAsync,
    isReadonly,
    readonly,
    setPotionInstance,
    setPotionPromiseCtor,
    setPotionURI
} from './metadata';
import {PotionBase} from './potion';
import {Item} from './item';


describe('potion/core', () => {
    describe('metadata.ts', () => {
        describe('getPotionInstance()/setPotionInstance()', () => {
            it('should get/set the Potion instance on an Item', () => {
                class Foo extends Item {}
                const foo = new Foo();
                const ctor = foo.constructor as typeof Foo;
                const potion: any = {
                    ping: true
                };

                expect(getPotionInstance(ctor)).toBeUndefined();
                setPotionInstance(ctor, potion);
                expect(getPotionInstance(ctor)).toEqual(potion);
            });
        });

        describe('getPotionURI()/setPotionURI()', () => {
            it('should get/set the uri on an Item instance', () => {
                class Foo extends Item {}
                const foo = new Foo();
                const ctor = foo.constructor as typeof Foo;
                const uri = '/foo';

                expect(getPotionURI(ctor)).toBeUndefined();
                setPotionURI(ctor, uri);
                expect(getPotionURI(ctor)).toEqual(uri);
            });
        });

        describe('@readonly/isReadonly()', () => {
            it('should get/set the readonly metadata on an item property', () => {
                class Foo extends Item {
                    @readonly
                    bar: string;

                    ipsum: boolean;
                }
                const foo = new Foo();

                expect(isReadonly<Foo>(foo, 'bar')).toBeTruthy();
                expect(isReadonly<Foo>(foo, 'ipsum')).toBeFalsy();
            });
        });

        describe('getPotionPromiseCtor()/setPotionPromiseCtor()', () => {
            it('should get/set the Promise constructor on the Potion instance', () => {
                class Potion1 extends PotionBase {
                    request(): any {}
                }
                const potionWithNativePromise = new Potion1();
                expect(getPotionPromiseCtor(potionWithNativePromise)).toEqual(Promise);

                const promise: any = {
                    ping: true
                };
                class Potion2 extends PotionBase {
                    request(): any {}
                }
                const potionWithCustomPromise = new Potion2();
                setPotionPromiseCtor(Potion2, promise);
                expect(getPotionPromiseCtor(potionWithCustomPromise)).toEqual(promise);
            });
        });

        describe('@async/isAsync()', () => {
            it('should get/set the readonly metadata on an item property', () => {
                class Foo extends Item {
                    @async
                    bar: Promise<string>;

                    ipsum: boolean;
                }
                const foo = new Foo();
                const ctor = foo.constructor as typeof Item;

                expect(isAsync(ctor, 'bar')).toBeTruthy();
                expect(isAsync(ctor, '/bar/1')).toBeTruthy();
                expect(isAsync(ctor, 'ipsum')).toBeFalsy();
            });
        });

        describe('@async/@readonly', () => {
            it('should get/set the readonly and async metadata on an item property', () => {
                class Foo extends Item {
                    @readonly
                    @async
                    bar: Promise<string>;

                    ipsum: boolean;
                }
                const foo = new Foo();
                const ctor = foo.constructor as typeof Item;

                expect(isAsync(ctor, 'bar')).toBeTruthy();
                expect(isAsync(ctor, '/bar/1')).toBeTruthy();
                expect(isAsync(ctor, 'ipsum')).toBeFalsy();
                expect(isReadonly<Foo>(foo, 'bar')).toBeTruthy();
                expect(isReadonly<Foo>(foo, 'ipsum')).toBeFalsy();
            });
        });

        describe('Inheritance', () => {
            it('child classes should inherit decorator metadata from the base class', () => {
                class Foo extends Item {
                    @async
                    lorem: Promise<string>;

                    @readonly
                    ilorem: boolean;
                }

                class FooBar extends Foo {
                    @async
                    ipsum: Promise<string>;

                    @readonly
                    iipsum: boolean;
                }

                class ChildOfFooBar extends FooBar {
                    @async
                    dolor: boolean;

                    @readonly
                    idolor: boolean;
                }

                const childOfFooBar = new ChildOfFooBar();

                expect(isAsync(ChildOfFooBar, 'lorem')).toBeTruthy();
                expect(isAsync(ChildOfFooBar, '/lorem/1')).toBeTruthy();
                expect(isAsync(ChildOfFooBar, 'ipsum')).toBeTruthy();
                expect(isAsync(ChildOfFooBar, '/ipsum/1')).toBeTruthy();
                expect(isAsync(ChildOfFooBar, 'dolor')).toBeTruthy();
                expect(isAsync(ChildOfFooBar, '/dolor/1')).toBeTruthy();

                expect(isReadonly<ChildOfFooBar>(childOfFooBar, 'ilorem')).toBeTruthy();
                expect(isReadonly<ChildOfFooBar>(childOfFooBar, 'iipsum')).toBeTruthy();
                expect(isReadonly<ChildOfFooBar>(childOfFooBar, 'idolor')).toBeTruthy();
            });
        });
    });
});
