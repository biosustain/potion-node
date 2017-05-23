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
 * Transform a Map to Object
 */
export function mapToObject(map: Map<any, any>): {[key: string]: any} {
	const obj = {};
	for (const [key, value] of entries<string, any>(map)) {
		obj[key] = value;
	}
	return obj;
}


export type KeyMapper = (key: string) => string;
export type ValueMapper = (value: any) => any;

// Type guard
// https://www.typescriptlang.org/docs/handbook/advanced-types.html
export function isJsObject(value: any): value is {} {
	return typeof value === 'object' && !Array.isArray(value) && value !== null;
}
export function isDate(value: any): value is Date {
	return value instanceof Date;
}
// tslint:disable-next-line: ban-types
export function isFunction(value: any): value is Function {
	return typeof value === 'function';
}
export function isAPotionItem(value: any): value is Item {
	return value instanceof Item;
}


/**
 * Deep Object.map()
 * NOTE: We assume that every nested value is either an Object, Array or some primitive value (also Date),
 * but we do not account for any other kind of object as it would not be the case for Potion.
 * @param {Object} obj
 * @param {ValueMapper} valueMapper - Transform operation to apply on the value.
 * @param {KeyMapper} keyMapper - Transform operation to apply on the key.
 * @param {Object} context - What should `this` be when the transform fns are applied.
 */
export function omap(obj: {} | any[], keyMapper: KeyMapper | null, valueMapper?: ValueMapper | null, context?: any): {[key: string]: any} | any[] {
	if (Array.isArray(obj)) {
		// NOTE: Value can be an Array or Object
		return obj.map(value => typeof value === 'object' ? omap(value, keyMapper, valueMapper, context) : value);
	} else if (isJsObject(obj)) {
		const result = {};

		for (const [key, value] of entries<string, any>(obj)) { // tslint:disable-line: prefer-const
			const k = isFunction(keyMapper) ? keyMapper.call(context, key) : key;

			// NOTE: Value can be an Array or Object
			if (typeof value === 'object' && !isDate(value) && !isAPotionItem(value)) {
				result[k] = omap(value, keyMapper, valueMapper, context);
			} else if (isFunction(valueMapper)) {
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
 * Convert an Object to Potion JSON
 */
export function toPotionJSON(json: any, prefix?: string): {[key: string]: any} {
	if (typeof json === 'object' && json !== null) {
		if (json instanceof Item && typeof json.uri === 'string') {
			return {$ref: `${typeof prefix === 'string' ? prefix : ''}${json.uri}`};
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
export function removeStrFromURI(uri: string, str: string): string {
	if (uri.indexOf(str) === 0) {
		return uri.substring(str.length);
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
