import {ItemCache} from './core';


/**
 * Camel case to snake case
 */
export function toSnakeCase(str: string, separator: string = '_'): string {
	return str.replace(/\.?([A-Z0-9]+)/g, (_, $2) => `${separator}${$2.toLowerCase()}`)
		.replace(/^_/, '');
}


/**
 * Snake case to camel case
 */
export function toCamelCase(str: string): string {
	return str.replace(/_([a-z0-9])/g, g => g[1].toUpperCase());
}


/**
 * Transform a Map to Object
 */
export function mapToObject(map: Map<any, any>): {[key: string]: any} {
	const obj = {};
	for (const [key, value] of entries<string, any>(map)) {
		obj[key] = value;
	}
	return obj;
}


/**
 * Deep Object.map()
 */
// TODO: Add unit tests (test all possible scenarios)
export type KeyMapper = (key: string) => string;
export type ValueMapper = (value: any) => any;

// Type guard
// https://www.typescriptlang.org/docs/handbook/advanced-types.html
export function isArray(value: any): value is any[] {
	return Array.isArray(value);
}
export function isJsObject(value: any): value is {} {
	return typeof value === 'object' && !isArray(value) && value !== null;
}
export function isDate(value: any): value is Date {
	return value instanceof Date;
}

export function omap(obj: {}, keyMapper: KeyMapper | null, valueMapper?: ValueMapper | null, context?: any): {[key: string]: any} {
	if (isArray(obj)) {
		// NOTE: Value can be an Array or Object
		return obj.map(value => typeof value === 'object' ? omap(value, keyMapper, valueMapper, context) : value);
	} else if (isJsObject(obj)) {
		const result = {};

		for (const [key, value] of entries<string, any>(obj)) { // tslint:disable-line: prefer-const
			const k = typeof keyMapper === 'function' ? keyMapper.call(context, key) : key;

			// NOTE: Value can be an Array or Object
			if (typeof value === 'object' && !isDate(value)) {
				result[k] = omap(value, keyMapper, valueMapper, context);
			} else if (typeof valueMapper === 'function') {
				result[k] = valueMapper.call(context, value);
			} else {
				result[k] = value;
			}
		}

		return result;
	}

	return obj;
}


/**
 * Merge array of objects into one object.
 */
export function merge(...objects: Array<{[key: string]: any}>): any {
	const result = {};
	for (const obj of objects) {
		Object.assign(result, obj);
	}
	return result;
}


/**
 * Check if an object is empty
 */
export function isObjectEmpty(obj: {}): boolean {
	return Object.keys(obj).length === 0;
}


/**
 * Transform an Object or Map to pairs of [key, value].
 */
export function entries<K, V>(object: any): Array<[K, V]> {
	let entries: any;
	if (object instanceof Map) {
		entries = object.entries();
	} else if (isJsObject(object)) {
		entries = Object.entries(object);
	}
	return Array.from(entries) as Array<[K, V]>;
}


/**
 * In-Memory cache
 * Will be used by default by Potion for caching resources.
 */
export class MemCache implements ItemCache<any> {
	protected items: Map<string, any>;

	constructor() {
		this.items = new Map<string, any>();
	}

	get(key: string): any {
		return this.items.get(key);
	}

	put(key: string, item: any): any {
		return this.items.set(key, item).get(key);
	}

	remove(key: string): void {
		this.items.delete(key);
	}
}
