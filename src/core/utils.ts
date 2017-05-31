// tslint:disable: max-classes-per-file
import {Item} from './item';
import {Pagination} from './pagination';
import {ItemCache, PotionResources} from './potion';


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
export function isJsObject(value: any): value is {[key: string]; any} {
	return typeof value === 'object' && value !== null;
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
	if (isJsObject(obj) && !Array.isArray(obj)) {
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


export class SelfReference {
	constructor(readonly $uri: string) {}
	matches(uri: any): boolean {
		return this.$uri === uri;
	}
}

/**
 * Walk through Potion JSON and replace SelfReference objects from the roots (roots are just a lost of Potion item references).
 * @param json - Any value to walk through.
 * @param {Array<Item>} roots - A list of Potion items found in the passed JSON.
 */
// NOTE: Keep refs. to looped things in this set instead of altering the objects themselves.
// TODO: It's uncertain if this may need to be created every time we replace refs., we might need to do so.
const set = new WeakSet();
export function replaceSelfReferences(json: any, roots: Item[]): any {
	if (typeof json !== 'object' || json === null) {
		return json;
	} else if (set.has(json)) {
		// If the object we're about to walk through is a ref. we already parsed, just skip it and return it.
		return json;
	} else if (json instanceof Pagination) {
		const items = json.toArray()
			.map(value => replaceSelfReferences(value, roots));
		return json.update(items, json.total);
	} else if (Array.isArray(json)) {
		return json.map(value => replaceSelfReferences(value, roots));
	} else if (json instanceof SelfReference) {
		// Find the ref in the roots.
		return roots.find(item => json.matches(item.uri));
	} else if (Object.keys(json).length > 0) {
		// Object.keys() will only output the keys for custom classes, whereas objects builtins will be empty (which is what we want).
		// NOTE: Arrays will also work with Object.keys() and return the indexes.

		// We only add an object to the known sets if it's a reference (has {uri}).
		if (!Array.isArray(json) && json.uri) {
			set.add(json);
		}

		for (const [key, value] of Object.entries(json)) {
			if (value instanceof SelfReference) {
				const ref = roots.find(item => value.matches(item.uri));
				Object.assign(json, {
					[key]: ref
				});
			} else if (isJsObject(value)) {
				Object.assign(json, {
					[key]: replaceSelfReferences(value, roots)
				});
			}
		}
		return json;
	}

	return json;
}

/**
 * Recursively find every object with {uri} (a Potion item usually) and return a list with all.
 * @param json - A Potion JSON.
 * @return {Array<Item>}
 */
export function findRoots(json: any): Item[] {
	const roots: any[] = [];
	if (isJsObject(json) && Object.keys(json).length > 0) {
		if (set.has(json)) {
			// If we find the root in the set it means there is no need to continue.
			return [];
		} else if (json.uri) {
			// We only want to append unique roots.
			roots.push(json);
		}

		const values = Array.isArray(json) || json instanceof Pagination ? json : Object.values(json);
		for (const value of values) {
			roots.push(...findRoots(value));
		}
	}

	// Remove duplicate entries.
	const result: any[] = [];
	for (const root of roots) {
		if (result.findIndex(item => root.uri === item.uri) === -1) {
			result.push(root);
		}
	}

	return result;
}


/**
 * Generate a self reference
 */
export function toSelfReference(uri: string): SelfReference {
	return new SelfReference(uri);
}


/**
 * Convert an Object to Potion JSON
 */
export function toPotionJSON(json: any, prefix?: string): {[key: string]: any} {
	if (isJsObject(json)) {
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


export type PotionID = string | number | null;
/**
 * Parse a Potion ID
 */
export function parsePotionID(id: any): PotionID {
	if (typeof id === 'string' && id.length > 0) {
		return /^\d+$/.test(id) ? parseInt(id, 10) : id;
	} else if (Number.isInteger(id)) {
		return id;
	}
	return null;
}

/**
 * Get a Potion ID from a URI
 */
export function getPotionID(uri: string, resourceURI: string): PotionID {
	const index = uri.indexOf(`${resourceURI}/`);
	if (index !== -1) {
		const id = uri.substring(index)
			.split('/')
			.pop();
		return parsePotionID(id);
	}
	return null;
}


/**
 * Find a Potion resource based on URI
 */
export function findPotionResource(uri: string, resources: PotionResources): {resourceURI: string, resource: typeof Item} | undefined {
	const entry = Object.entries(resources)
		.find(([resourceURI]) => uri.indexOf(`${resourceURI}/`) === 0);
	if (entry) {
		const [resourceURI, resource] = entry;
		return {
			resourceURI,
			resource
		};
	}
}

/**
 * Check if some string is a Potion URI
 */
export function isPotionURI(uri: string, resources: PotionResources): boolean {
	const entry = findPotionResource(uri, resources);
	if (entry) {
		return getPotionID(uri, entry.resourceURI) !== null;
	}
	return false;
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
