/* tslint:disable:max-file-line-count */
import {
	decorateCtorWithPotionInstance,
	decorateCtorWithPotionURI,
	potionPromise,
	readonly
} from './metadata';
import {Item, ItemOptions} from './item';
import {Pagination, PaginationOptions} from './pagination';
import {
	entries,
	mapToObject,
	MemCache,
	omap,
	toCamelCase,
	toSnakeCase
} from '../utils';


/**
 * Item cache.
 * Dictates the implementation of the item cache.
 */
export interface ItemCache<T extends Item> {
	has(key: string): boolean;
	get(key: string): Promise<T>;
	put(key: string, item: Promise<T>): Promise<T>;
	remove(key: string): void;
}


/**
 * Common interfaces.
 */

export interface ParsedURI {
	resource: typeof Item;
	id: string | number;
	uri: string;
}

// TODO: Start using a more standard impl. of these interfaces (either create proper classes for some or use the native Request, etc.)
export interface URLSearchParams {
	[key: string]: any;
}

export interface RequestOptions {
	method?: string;
	search?: URLSearchParams | null;
	data?: any;
	cache?: boolean;
}

export interface FetchOptions extends RequestOptions {
	paginate?: boolean;
}

export interface QueryOptions extends PaginationOptions {
	where?: any;
	sort?: any;
}

export interface PotionResponse {
	data: any;
	headers: any;
}


export interface PotionOptions {
	host?: string;
	prefix?: string;
	cache?: ItemCache<Item>;
}


export function getErrorMessage(error: any, uri: string): string {
	if (error instanceof Error) {
		return error.message;
	} else if (typeof error === 'string') {
		return error;
	}
	return `An error occurred while Potion tried to retrieve a resource from '${uri}'.`;
}

export function canAggregateURI({$type, $id}: {[key: string]: any}): boolean {
	return (typeof $id === 'string' || Number.isInteger($id)) && typeof $type === 'string';
}

export function getURI({$uri, $ref, $type, $id}: {[key: string]: any}): string {
	if (typeof $uri === 'string') {
		return decodeURIComponent($uri);
	} else if (typeof $ref === 'string') {
		return decodeURIComponent($ref);
	} else if (canAggregateURI({$type, $id})) {
		return `/${$type}/${$id}`;
	}
	return '';
}

export function removePrefix(uri: string, prefix: string): string {
	if (uri.indexOf(prefix) === 0) {
		return uri.substring(prefix.length);
	}
	return uri;
}

export function parseID(id: any): string | number | null {
	if (typeof id === 'string') {
		return /^\d+$/.test(id) ? parseInt(id, 10) : id;
	} else if (Number.isInteger(id)) {
		return id;
	}
	return null;
}


/**
 * This class contains the main logic for interacting with the Flask Potion backend.
 * Note that this class does not contain the logic for making the HTTP requests,
 * it is up to the child class to implement the logic for that through the `request` method.
 * Furthermore, the child class also needs to provide the Promise class/fn as this class is set to use the native Promise only available from ES6.
 *
 * @example
 * class Potion extends PotionBase {
 *     protected request(uri, options?: RequestOptions): Promise<any> {
 *         // Here we need to implement the actual HTTP request
 *     };
 * }
 */
export abstract class PotionBase {
	readonly resources: {[key: string]: Item} = {};
	readonly cache: ItemCache<Item>;
	host: string;
	readonly prefix: string;

	private readonly Promise: typeof Promise = potionPromise(this); // NOTE: This is needed only to provide support for AngularJS.
	private pendingGETRequests: Map<string, any> = new Map();

	constructor({host = '', prefix = '', cache}: PotionOptions = {}) {
		this.cache = cache || new MemCache();
		this.host = host;
		this.prefix = prefix;
	}

	fetch(uri: string, fetchOptions?: FetchOptions, pagination?: Pagination<any>): Promise<Item | Item[] | Pagination<Item> | any> {
		const options: FetchOptions = {...fetchOptions};
		const {method, cache, paginate, search} = options;
		const key = uri;
		const {Promise} = this;

		// Add the API prefix if not present
		const {prefix} = this;
		if (uri.indexOf(prefix) === -1) {
			uri = `${prefix}${uri}`;
		}

		// Serialize request to Potion JSON.
		const fetch = () => this.request(`${this.host}${uri}`, this.serialize(options))
			// Deserialize the Potion JSON.
			.then(response => this.deserialize(response, uri, options, pagination));

		// TODO: Cache requests for queries with params as well,
		// we just need to create a hash key for the request (uri + search params).
		if (method === 'GET' && !paginate && !search) {
			// If a GET request was made and {cache: true} return the item from cache (if it exists).
			// NOTE: Queries are not cached.
			if  (cache && this.cache.has(key)) {
				return this.cache.get(key);
			}

			// Cache the request so that further requests for the same resource will not make an aditional XHR.
			if (!this.pendingGETRequests.has(uri)) {
				this.pendingGETRequests.set(uri, fetch().then(data => {
					this.pendingGETRequests.delete(uri);
					return data;
				}, err => {
					// If request fails,
					// make sure to remove the pending request so further requests can be made,
					// but fail the pipeline.
					this.pendingGETRequests.delete(uri);
					const message = getErrorMessage(err, uri);
					return Promise.reject(message);
				}));
			}

			return this.pendingGETRequests.get(uri);
		} else {
			return fetch();
		}
	}

	/**
	 * Register a resource.
	 * @param {String} uri - Path on which the resource is registered.
	 * @param {Item} resource
	 * @param {ItemOptions} options - Set the property options for any instance of the resource (setting a property to readonly for instance).
	 */
	register(uri: string, resource: any, options?: ItemOptions): Item {
		decorateCtorWithPotionInstance(resource, this);
		decorateCtorWithPotionURI(resource, uri);

		if (options && Array.isArray(options.readonly)) {
			options.readonly.forEach(property => readonly(resource, property));
		}
		this.resources[uri] = resource;

		return resource;
	}

	/**
	 * Register a resource.
	 * @param {String} uri - Path on which the resource is registered.
	 * @param {ItemOptions} options - Set the property options for any instance of the resource (setting a property to readonly for instance).
	 *
	 * @example
	 * @potion.registerAs('/user')
	 * class User extends Item {}
	 */
	registerAs(uri: string, options?: ItemOptions): ClassDecorator {
		return (target: any) => {
			this.register(uri, target, options);
			return target;
		};
	}

	/**
	 * Make a HTTP request.
	 * @param {string} uri
	 * @param {RequestOptions} options
	 * @returns {PotionResponse} An object with {data, headers} where {data} can be anything and {headers} is an object with the response headers from the HTTP request.
	 */
	protected abstract request(uri: string, options?: RequestOptions): Promise<PotionResponse>;

	private serialize(options: FetchOptions): RequestOptions {
		const {search} = options;

		return {
			...options,
			...{
				search: this.toPotionJSON(options.paginate ? {page: 1, perPage: 25, ...search} : search),
				data: this.toPotionJSON(options.data)
			}
		};
	}
	private toPotionJSON(json: any): {[key: string]: any} {
		if (typeof json === 'object' && json !== null) {
			if (json instanceof Item && typeof json.uri === 'string') {
				return {$ref: `${this.prefix}${json.uri}`};
			} else if (json instanceof Date) {
				return {$date: json.getTime()};
			} else if (Array.isArray(json)) {
				return json.map(item => this.toPotionJSON(item));
			} else {
				return omap(json, key => toSnakeCase(key), value => this.toPotionJSON(value), this);
			}
		} else {
			return json;
		}
	}

	private deserialize({data, headers}: PotionResponse, uri: string, options: FetchOptions, pagination?: Pagination<any>): Promise<PotionResponse> {
		return this.fromPotionJSON(data)
			.then(json => {
				// Return or update Pagination
				// TODO: Refactor this, looks messy (pagination logic should be handled in the Pagination class)
				if (options.paginate) {
					const count = headers['x-total-count'] || json.length;
					if (!pagination) {
						return new Pagination<Item>({uri, potion: this}, json, count, options);
					} else {
						return pagination.update(json, count);
					}
				}
				return json;
			});
	}
	private fromPotionJSON(json: any): Promise<any> {
		const {Promise} = this;

		if (typeof json === 'object' && json !== null) {
			if (Array.isArray(json)) {
				return Promise.all(json.map(item => this.fromPotionJSON(item)));
			} else if (typeof json.$uri === 'string' || canAggregateURI(json)) {
				// NOTE: The json may also have {$type, $id} that can be used to recognize a resource instead of {$uri}.
				// If neither combination is provided it will throw.
				return this.parseURI(json)
					.then(({resource, id, uri}) => {
						const properties: Map<string, any> = new Map();
						// NOTE: {id}
						properties.set('$id', id);
						properties.set('$uri', uri);
						const unpack = this.parsePotionJSONProperties(json, properties);

						// Create and cache the resource if it does not exist.
						if (!this.cache.has(uri)) {
							return this.cache.put(uri, unpack.then(properties => Reflect.construct(resource, [properties])));
						} else {
							// If the resource already exists,
							// update it with new properties.
							return Promise.all([unpack, this.cache.get(uri)])
								.then(([properties, item]) => {
									Object.assign(item, properties);
									return item;
								});
						}
					});
			} else if (typeof json.$schema === 'string') {
				// If we have a schema object,
				// we want to resolve it as it is and not try to resolve references or do any conversions.
				// Though, we want to convert snake case to camel case.
				return Promise.resolve(omap(json, key => toCamelCase(key)));
			} else if (Object.keys(json).length === 1) {
				if (typeof json.$ref === 'string') {
					// Hack to not try to resolve self references.
					// TODO: Implement resolving self-references
					if (json.$ref === '#') {
						return Promise.resolve(json.$ref);
					}

					return this.parseURI(json)
						.then(({uri}) => this.fetch(uri, {
							cache: true,
							method: 'GET'
						}));
				} else if (typeof json.$date !== 'undefined') {
					// Parse Potion date
					return Promise.resolve(new Date(json.$date));
				}
			}

			return this.parsePotionJSONProperties(json);
		} else {
			return Promise.resolve(json);
		}
	}
	// Try to parse a Potion URI and find the associated resource for it,
	// otherwise return a rejected promise.
	private parseURI({$ref, $uri, $type, $id}: {[key: string]: any}): Promise<ParsedURI> {
		const {Promise} = this;
		const uri = removePrefix(getURI({$ref, $uri, $type, $id}), this.prefix);

		const entry = entries<string, any>(this.resources)
			.find(([resourceURI]) => uri.indexOf(`${resourceURI}/`) === 0);

		if (!entry) {
			return Promise.reject(new Error(`URI '${uri}' is an uninterpretable or unknown Potion resource.`));
		} else {
			const [resourceURI, resource] = entry;
			const params = {resource, uri};
			const id = parseID($id);

			if (id !== null) {
				Object.assign(params, {id});
			} else {
				const [part] = uri.substring(resourceURI.length + 1)
					.split('/');
				Object.assign(params, {
					id: parseID(part)
				});
			}

			return Promise.resolve(params);
		}
	}
	private parsePotionJSONProperties(json: any, properties: Map<any, any> = new Map()): any {
		const {Promise} = this;
		const promises: Array<Promise<any>> = [];

		for (const [key, value] of entries<string, any>(json)) {
			promises.push(this.fromPotionJSON(value).then(value => {
				properties.set(toCamelCase(key), value);
				return value;
			}));
		}

		return Promise.all(promises)
			.then(() => mapToObject(properties));
	}
}
