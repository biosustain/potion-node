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
	return str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
}


/**
 * Transform pairs of [[key, value]] to {[key]: value}
 */
export function pairsToObject(pairs: any[]): any {
	let obj = {};
	for (let [key, value] of pairs) {
		obj[key] = value;
	}
	return obj;
}


/**
 * Object.map()
 */
export function omap(object: Object, callback: (key: string, value: any) => [string, any], context?: any): any {
	let map = {};
	for (let [key, value] of (Object as any).entries(object)) {
		let [k, v] = callback.call(context, key, value);
		map[k] = v;
	}
	return map;
}


/**
 * Deep Object.map()
 */
export type KeyMapper = (key: string) => string;
export type ValueMapper = (value: any) => any;

export function deepOmap(obj: Object, valueMapper: ValueMapper | null, keyMapper: KeyMapper | null, context?: any): any {
	if (Array.isArray(obj)) {
		return (obj as any[]).map(
			(value) => typeof value === 'object'
				? deepOmap(value, valueMapper, keyMapper, context)
				: value
		);
	} else if (typeof obj === 'object') {
		const result = {};

		for (let [key, value] of Object.entries(obj)) {
			key = typeof keyMapper === 'function'
				? keyMapper.call(context, key)
				: key;
			result[key] = typeof value === 'object' || Array.isArray(value)
				? deepOmap(value, valueMapper, keyMapper, context)
				: typeof valueMapper === 'function'
					? valueMapper.call(context, value)
					: value;
		}

		return result;
	}

	return obj;
}


/**
 * Merge array of objects into one object.
 */
export function merge(objects: any[]): any {
	const result = {};
	for (let obj of objects) {
		Object.assign(result, obj);
	}
	return result;
}


/**
 * Check if an object is empty
 */
export function isEmpty(obj: Object): boolean {
	return Object.keys(obj).length === 0;
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
