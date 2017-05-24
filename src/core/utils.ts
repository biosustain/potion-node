import {Item} from './item';
import {ItemCache} from './potion';


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
 * Object type guard
 * Docs: https://www.typescriptlang.org/docs/handbook/advanced-types.html
 */
export function isJsObject(value: any): value is {} {
	return typeof value === 'object' && !Array.isArray(value) && value !== null;
}
/**
 * Check if an object is empty
 */
export function isObjectEmpty(obj: {}): boolean {
	return Object.keys(obj).length === 0;
}

/**
 * Function type guard
 */
// tslint:disable-next-line: ban-types
export function isFunction(value: any): value is Function {
	return typeof value === 'function';
}


export type KeyMapFunction = (key: string) => string;
export type ValueMapFunction = (value: any) => any;
/**
 * Object.map()
 * NOTE: This is NOT a recursive fn.
 * @param {Object} obj
 * @param {Function} keyMapFunction - Transform operation to apply on the key.
 * @param {Function} [valueMapFunction] - Transform operation to apply on the value.
 * @returns {Object}
 */
export function omap(obj: {[key: string]: any}, keyMapFunction: KeyMapFunction, valueMapFunction?: ValueMapFunction): {[key: string]: any} {
	if (isJsObject(obj)) {
		return Object.entries(obj)
			.map(([key, value]) => [isFunction(keyMapFunction) ? keyMapFunction(key) : key, isFunction(valueMapFunction) ? valueMapFunction(value) : value])
			.reduce((a: {}, [key, value]) => Object.assign(a, {[key]: value}), {});
	}
	return obj;
}


/**
 * Aggregate a str based on an Error object and uri
 */
export function getErrorMessage(error: any, uri?: string): string {
	const message = 'An error occurred while Potion tried to retrieve a resource';
	if (error instanceof Error) {
		return error.message;
	} else if (typeof error === 'string') {
		return error;
	} else if (typeof uri === 'string') {
		return `${message} from '${uri}'.`;
	}
	return `${message}.`;
}


/**
 * Convert JSON schema to a JS object
 */
export function fromSchemaJSON(json: any): {[key: string]: any} {
	if (Array.isArray(json)) {
		return json.map(value => typeof value === 'object' ? fromSchemaJSON(value) : value);
	} else if (isJsObject(json)) {
		return Object.entries<any>(json)
			.map(([key, value]) => [toCamelCase(key), typeof value === 'object' ? fromSchemaJSON(value) : value])
			.reduce((a, [key, value]) => Object.assign(a, {[key]: value}), {});
	}
	return json;
}


/**
 * Convert an Object to Potion JSON
 */
export function toPotionJSON(json: any, prefix?: string): {[key: string]: any} {
	if (typeof json === 'object' && json !== null) {
		if (json instanceof Item && typeof json.uri === 'string') {
			return {$ref: `${addPrefixToURI(json.uri, prefix)}`};
		} else if (json instanceof Date) {
			return {$date: json.getTime()};
		} else if (Array.isArray(json)) {
			return json.map(item => toPotionJSON(item, prefix));
		}
		return omap(json, key => toSnakeCase(key), value => toPotionJSON(value, prefix));
	}
	return json;
}

/**
 * Parse a Potion ID
 */
export function parsePotionID(id: any): string | number | null {
	if (typeof id === 'string') {
		return /^\d+$/.test(id) ? parseInt(id, 10) : id;
	} else if (Number.isInteger(id)) {
		return id;
	}
	return null;
}

/**
 * Get the Potion URI from a Potion JSON object
 */
export function hasTypeAndId({$type, $id}: {[key: string]: any}): boolean {
	return (typeof $id === 'string' || Number.isInteger($id)) && typeof $type === 'string';
}
export function getPotionURI({$uri, $ref, $type, $id}: {[key: string]: any}): string {
	if (typeof $uri === 'string') {
		return decodeURIComponent($uri);
	} else if (typeof $ref === 'string') {
		return decodeURIComponent($ref);
	} else if (hasTypeAndId({$type, $id})) {
		return `/${$type}/${$id}`;
	}
	return '';
}

/**
 * Remove some string from another string
 */
export function removePrefixFromURI(uri: string, str: string): string {
	if (uri.includes(str)) {
		return uri.substring(str.length);
	}
	return uri;
}
/**
 * Add a prefix to some string (if not already there)
 */
export function addPrefixToURI(uri: string, prefix?: string): string {
	if (typeof prefix === 'string' && !uri.includes(prefix)) {
		return `${prefix}${uri}`;
	}
	return uri;
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
 * In-Memory cache
 * Will be used by default by Potion for caching resources.
 */
export class MemCache<T extends Item> implements ItemCache<T> {
	protected items: Map<string, any> = new Map<string, Promise<T>>();

	has(key: string): boolean {
		return this.items.has(key);
	}
	get(key: string): Promise<T> {
		return this.items.get(key);
	}
	put(key: string, item: Promise<T>): Promise<T> {
		return this.items.set(key, item)
			.get(key);
	}

	remove(key: string): void {
		this.items.delete(key);
	}
}
