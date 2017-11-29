import {
    getGlobal,
    isFunction,
    isJsObject,
    isString
} from './utils';
import {PotionBase} from './potion';
import {Item} from './item';


const global = getGlobal();
const Reflect = global.Reflect; // tslint:disable-line: variable-name

// Make sure Reflect API is available,
// otherwise throw an error.
// See https://github.com/angular/angular/blob/60727c4d2ba1e4b0b9455c767d0ef152bcedc7c2/modules/angular2/src/core/util/decorators.ts#L243
// tslint:disable-next-line:only-arrow-functions
(function checkReflect(): void {
    if (!(Reflect && Reflect.getMetadata)) {
        throw new Error('Dependency error. reflect-metadata shim is required when using potion-node library');
    }
})();


const potionInstanceMetadataKey = Symbol('potion:instance');
const potionURIMetadataKey = Symbol('potion:uri');
const potionPromiseCtorMetadataKey = Symbol('potion:promise');
const potionReadonlyMetadataKey = Symbol('potion:readonly');
const potionAsyncMetadataKey = Symbol('potion:async');


/**
 * Get the Potion instance from an Item constructor
 * @param ctor
 */
export function getPotionInstance(ctor: typeof Item): PotionBase {
    return Reflect.getOwnMetadata(potionInstanceMetadataKey, ctor);
}
/**
 * Set the Potion instance on an Item constructor
 * @param ctor
 * @param instance
 */
export function setPotionInstance(ctor: typeof Item, instance: PotionBase): void {
    Reflect.defineMetadata(potionInstanceMetadataKey, instance, ctor);
}


/**
 * Get the Item uri from the Item constructor
 * @param ctor
 */
export function getPotionURI(ctor: typeof Item): string {
    return Reflect.getOwnMetadata(potionURIMetadataKey, ctor);
}
/**
 * Set the Item uri
 * @param ctor
 * @param uri
 */
export function setPotionURI(ctor: typeof Item, uri: string): void {
    Reflect.defineMetadata(potionURIMetadataKey, uri, ctor);
}


/**
 * Get/Set the Promise implementation that should be used by Potion.
 * NOTE: If it is never set, it will fallback to using the native implementation of Promise.
 * @example
 * @PotionConfig({
 *     promiseCtor: Promise
 * })
 * class Potion extends PotionBase {
 *     ...
 * }
 */

export function getPotionPromiseCtor(potion: PotionBase): typeof Promise {
    return Reflect.getOwnMetadata(potionPromiseCtorMetadataKey, potion.constructor) || Promise;
}

export function setPotionPromiseCtor(target: typeof PotionBase, promiseCtor: any): void {
    Reflect.defineMetadata(potionPromiseCtorMetadataKey, promiseCtor, target);
}


/**
 * Check if a resource property is readonly
 */
export function isReadonly<T extends Item>(item: T, key: keyof T): boolean {
    const ctors = getCtor(item.constructor as typeof Item);
    const metadata = ctors.map(ctor => Reflect.getOwnMetadata(potionReadonlyMetadataKey, ctor));

    for (const meta of metadata) {
        if (isJsObject(meta)) {
            const isReadonly = key && meta[key];
            if (isReadonly) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Mark a resource property as readonly and omit when saved.
 * @example
 * class User extends Item {
 *     @readonly
 *     age;
 * }
 */
export function readonly(target: object, property: string): void {
    decorate(target, potionReadonlyMetadataKey, property);
}


/**
 * Check if a resource property is async
 */
export function isAsync(cls: typeof Item, keyOrUri: string): boolean {
    const ctors = getCtor(cls);
    const metadata = ctors.map(ctor => Reflect.getOwnMetadata(potionAsyncMetadataKey, ctor));

    // Look up the prototype chain for this property and check if it is set
    if (isString(keyOrUri)) {
        for (const meta of metadata) {
            if (isJsObject(meta)) {
                const key = Object.keys(meta)
                    .find(key => key === keyOrUri || keyOrUri.includes(key));
                const isAsync = key && meta[key];
                if (isAsync) {
                    return true;
                }
            }
        }
    }

    return false;
}


/**
 * Walk the prototype chain and register all the constructors
 * @param cls
 */
function getCtor(cls: typeof Item): Array<typeof Item> {
    const ctors = [cls];
    let ctor = Object.getPrototypeOf(cls);
    while (ctor.prototype) {
        ctors.push(ctor);
        ctor = Object.getPrototypeOf(ctor);
    }
    return ctors;
}


/**
 * Mark a resource property as async.
 * @example
 * class User extends Item {
 *     @async
 *     age: Promise<Foo>;
 * }
 */
export function async(target: object, property: string): void {
    decorate(target, potionAsyncMetadataKey, property);
}


/**
 * Helper fn for decorating class properties
 * @param target
 * @param key
 * @param property
 */
function decorate(target: object, key: symbol, property: string): void {
    const constructor = isFunction(target)
        ? target
        : isFunction(target.constructor)
            ? target.constructor
            : null;
    if (constructor) {
        const metadata = Reflect.getOwnMetadata(key, constructor);
        Reflect.defineMetadata(key, {
            ...metadata,
            [property]: true
        }, constructor);
    }
}
