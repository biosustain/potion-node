import {ItemCache} from './core';


/**
 * Camel case to snake case
 */
// TODO: we need to add an underscore between number and string as well
export function toSnakeCase(str: string, separator: string = '_'): string {
	return str.replace(/([a-z][A-Z])/g, (g) => `${g[0]}${separator}${g[1].toLowerCase()}`);
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
export function omap(object: Object, callback: (key: string, value: any) => any, context?: any): any {
	let map = {};
	for (let [key, value] of (Object as any).entries(object)) {
		let [k, v] = callback.call(context, key, value);
		map[k] = v;
	}
	return map;
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
