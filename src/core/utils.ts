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
export function isJsObject(value: any): value is {[key: string]: any} {
    return typeof value === 'object' && value !== null;
}

/**
 * Check if an object is empty
 */
export function isObjectEmpty(obj: {}): boolean {
    return Object.keys(obj).length === 0;
}

/**
 * Check if a value is a string
 */
export function isString(value: any): value is string {
    return typeof value === 'string';
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
 * @param obj
 * @param keyMapFunction - Transform operation to apply on the key.
 * @param [valueMapFunction] - Transform operation to apply on the value.
 */
export function omap(obj: {[key: string]: any}, keyMapFunction: KeyMapFunction, valueMapFunction?: ValueMapFunction): {[key: string]: any} {
    if (isJsObject(obj) && !Array.isArray(obj)) {
        return Object.entries(obj)
            .map(([key, value]) => [isFunction(keyMapFunction) ? keyMapFunction(key) : key, isFunction(valueMapFunction) ? valueMapFunction(value) : value])
            .reduce((a: {}, [key, value]) => ({
                ...a,
                [key]: value
            }), {});
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
    } else if (isString(error)) {
        return error;
    } else if (isString(uri)) {
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
            .reduce((a, [key, value]) => ({
                ...a,
                [key]: value
            }), {});
    }
    return json;
}


export class SelfReference {
    constructor(readonly $uri: string) {}
    matches(json: any): boolean {
        return isJsObject(json) && this.$uri === json.uri;
    }
}

export class LazyPromiseRef<T> {
    constructor(readonly getter: (replaceRefs?: boolean) => PromiseLike<T>) {}
}

/**
 * Walk through Potion JSON and replace SelfReference/LazyPromiseRef objects from the roots (roots are just a lost of Potion item references).
 * @param json - Any value to walk through.
 * @param roots - A list of Potion items found in the passed JSON.
 */
// NOTE: Keep refs. to looped things in this set instead of altering the objects themselves.
// TODO: It's uncertain if this may need to be created every time we replace refs., we might need to do so.
const set = new WeakSet();
export function replaceReferences(json: any, roots: Map<string, any>): any {
    if (typeof json !== 'object' || json === null || json.hasOwnProperty('$schema')) {
        return json;
    } else if (set.has(json)) {
        // If the object we're about to walk through is a ref. we already parsed, just skip it and return it.
        return json;
    } else if (json instanceof Pagination) {
        const items = json.toArray()
            .map(value => replaceReferences(value, roots));
        return json.update(items, json.total);
    } else if (Array.isArray(json)) {
        return json.map(value => replaceReferences(value, roots));
    } else if (json instanceof SelfReference) {
        // Find the ref in the roots.
        return roots.get(json.$uri);
    } else if (Object.keys(json).length > 0) {
        // Object.keys() will only output the keys for custom classes, whereas objects builtins will be empty (which is what we want).
        // NOTE: Arrays will also work with Object.keys() and return the indexes.

        // We only add an object to the known sets if it's a reference (has {uri}).
        if (!Array.isArray(json) && json.uri) {
            set.add(json);
        }

        for (const [key, value] of Object.entries(json)) {
            if (value instanceof SelfReference) {
                const ref = roots.get(value.$uri);
                Object.assign(json, {
                    [key]: ref
                });
            } else if (value instanceof LazyPromiseRef) {
                // Cache the result of the lazy promise
                let promise: PromiseLike<any>;
                Object.defineProperty(json, key, {
                    get() {
                        if (promise) {
                            return promise;
                        }
                        promise = value.getter(true);
                        return promise;
                    }
                });
            } else if (isJsObject(value)) {
                Object.assign(json, {
                    [key]: replaceReferences(value, roots)
                });
            } else if (isString(value) && value === '#') {
                Object.assign(json, {
                    [key]: roots.get('#')
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
 */
export function findRoots(json: any, skip?: boolean): Map<string, any> {
    const roots: Map<string, any> = new Map();
    if (isJsObject(json) && Object.keys(json).length > 0) {
        // NOTE: We add the root json because we might encouter '#' wich resolves to the root object.
        if (!skip) {
            roots.set('#', json);
        }
        if (set.has(json) || json.hasOwnProperty('$schema')) {
            // If we find the root in the set it means there is no need to continue.
            return new Map();
        } else if (json.uri && !roots.has(json.uri)) {
            // We only want to append unique roots.
            roots.set(json.uri, json);
        }

        const values = Array.isArray(json) || json instanceof Pagination ? json : Object.values(json);
        for (const value of values) {
            const result = findRoots(value, true);
            for (const [uri, root] of result.entries()) {
                roots.set(uri, root);
            }
        }
    }

    return roots;
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
        if (json instanceof Item && isString(json.uri)) {
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
    if (isString(id) && id.length > 0) {
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
    if (isString(uri)) {
        const entry = Object.entries(resources)
            .sort(([a], [b]) => b.length - a.length)
            .find(([resourceURI]) => uri.indexOf(resourceURI) !== -1);
        if (entry) {
            const [resourceURI, resource] = entry;
            return {
                resourceURI,
                resource
            };
        }
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
    return (isString($id) || Number.isInteger($id)) && isString($type);
}
export function getPotionURI({$uri, $ref, $type, $id}: {[key: string]: any}): string {
    if (isString($uri)) {
        return decodeURIComponent($uri);
    } else if (isString($ref)) {
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
    if (isString(prefix) && !uri.includes(prefix)) {
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


/**
 * Get global object
 * https://github.com/hemanth/es-next#global
 */
declare const global: any;
export function getGlobal(): any {
    if (typeof self !== 'undefined') {
        return self;
    } else if (typeof window !== 'undefined') {
        return window;
    } else if (typeof global !== 'undefined') {
        return global;
    }
}
