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


const POTION_METADATA_KEY = Symbol('potion');
export function potionInstance(ctor: typeof Item): PotionBase {
	return Reflect.getOwnMetadata(POTION_METADATA_KEY, ctor);
}
export function decorateCtorWithPotionInstance(ctor: typeof Item, instance: any): void {
	Reflect.defineMetadata(POTION_METADATA_KEY, instance, ctor);
}


const POTION_URI_METADATA_KEY = Symbol('potion:uri');
export function potionURI(ctor: typeof Item): string {
	return Reflect.getOwnMetadata(POTION_URI_METADATA_KEY, ctor);
}
export function decorateCtorWithPotionURI(ctor: typeof Item, uri: string): void {
	Reflect.defineMetadata(POTION_URI_METADATA_KEY, uri, ctor);
}


/**
 * Get/Set the Promise implementation that should be used by Potion.
 * NOTE: If it is never set, it will fallback to using the native implementation of Promise.
 * @example
 * class Potion extends PotionBase {
 *     ...
 * }
 * setPotionPromise(Potion, ... some impl. of a Promise);
 */
const POTION_PROMISE_METADATA_KEY = Symbol('potion:promise');
export function potionPromise(potion: PotionBase): typeof Promise {
	return Reflect.getOwnMetadata(POTION_PROMISE_METADATA_KEY, potion.constructor) || Promise;
}
export function setPotionPromise(ctor: typeof PotionBase, promise: any): void {
	Reflect.defineMetadata(POTION_PROMISE_METADATA_KEY, promise, ctor);
}


const READONLY_METADATA_KEY = Symbol('potion:readonly');
export function isReadonly(ctor: any, key: string): boolean {
	const metadata = Reflect.getOwnMetadata(READONLY_METADATA_KEY, ctor);
	return metadata && metadata[key];
}

/**
 * Mark a resource property as readonly and omit when saved.
 *
 * @example
 * class User extends Item {
 *     @readonly
 *     age;
 * }
 */
export function readonly(target: any, property: string): void {
	const constructor = isFunction(target)
		? target
		: isFunction(target.constructor)
			? target.constructor
			: null;

	if (constructor === null) {
		// TODO: maybe throw an error here
		return;
	}

	Reflect.defineMetadata(
		READONLY_METADATA_KEY,
		Object.assign(
			Reflect.getOwnMetadata(READONLY_METADATA_KEY, constructor) || {},
			{
				[property]: true
			}
		),
		constructor
	);
}
