import {getGlobal, isFunction} from './utils';
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
    const metadata = Reflect.getOwnMetadata(potionReadonlyMetadataKey, item.constructor);
    return metadata && metadata[key];
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
    const constructor = isFunction(target)
        ? target
        : isFunction(target.constructor)
            ? target.constructor
            : null;
    if (constructor) {
        const metadata = Reflect.getOwnMetadata(potionReadonlyMetadataKey, constructor);
        Reflect.defineMetadata(potionReadonlyMetadataKey, {
            ...metadata,
            [property]: true
        }, constructor);
    }
}
