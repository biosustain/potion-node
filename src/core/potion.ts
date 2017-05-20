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
	isArray,
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
	uri: string;
	resource: typeof Item;
	params: string[];
}

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
		const {method, cache, paginate, data} = options;
		let {search} = options;
		const key = uri;
		const {Promise} = this;

		// Add the API prefix if not present
		const {prefix} = this;
		if (uri.indexOf(prefix) === -1) {
			uri = `${prefix}${uri}`;
		}

		if (paginate) {
			// If no page was provided set to first
			// Default to 25 items per page
			search = options.search = Object.assign({page: 1, perPage: 25}, search);
		}

		// Convert the {data, search} object props to snake case.
		// Serialize all values to Potion JSON.
		const fetch = () => this.request(`${this.host}${uri}`, {...options, ...{
				search: this.toPotionJSON(search),
				data: this.toPotionJSON(data)
			}})
			// Convert the data to Potion JSON
			.then(response => this.deserialize(response))
			.then(({headers, data}) => {
				// Return or update Pagination
				if (paginate) {
					const count = headers['x-total-count'] || data.length;
					if (!pagination) {
						return new Pagination<Item>({uri, potion: this}, data, count, options);
					} else {
						return pagination.update(data, count);
					}
				}
				return data;
			});

		if (method === 'GET' && !search) {
			// If a GET request was made and {cache: true},
			// try to get item from cache and return a resolved promise with the cached item.
			// NOTE: Queries are not cached.
			if  (cache) {
				if (this.cache.has(key)) {
					return this.cache.get(key);
				}
			}

			// If we already asked for the resource,
			// return the exiting pending request promise.
			if (this.pendingGETRequests.has(uri)) {
				return this.pendingGETRequests.get(uri);
			}

			const request = fetch();
			// Save pending request
			this.pendingGETRequests.set(uri, request);

			return request.then(data => {
				this.pendingGETRequests.delete(uri);
				return data;
			}, err => {
				// If request fails,
				// make sure to remove the pending request so further requests can be made.
				// Return is necessary.
				this.pendingGETRequests.delete(uri);
				const message = err instanceof Error
					? err.message
					: typeof err === 'string'
						? err
						: `An error occurred while Potion tried to retrieve a resource from '${uri}'.`;
				return Promise.reject(message);
			});
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

		if (options && isArray(options.readonly)) {
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
	protected abstract request(uri: string, options?: RequestOptions): Promise<PotionResponse>; // tslint:disable-line: prefer-function-over-method

	// Try to parse a Potion URI and find the associated resource for it,
	// otherwise return a rejected promise.
	private parseURI(uri: string): Promise<ParsedURI> {
		const {Promise} = this;

		uri = decodeURIComponent(uri);
		if (uri.indexOf(this.prefix) === 0) {
			uri = uri.substring(this.prefix.length);
		}

		for (const [resourceURI, resource] of entries<string, any>(this.resources)) {
			if (uri.indexOf(`${resourceURI}/`) === 0) {
				return Promise.resolve({
					uri,
					resource,
					params: uri.substring(resourceURI.length + 1)
						.split('/')
				});
			}
		}

		return Promise.reject(new Error(`URI '${uri}' is an uninterpretable or unknown potion resource.`));
	}

	private toPotionJSON(json: any): {[key: string]: any} {
		if (typeof json === 'object' && json !== null) {
			if (json instanceof Item && typeof json.uri === 'string') {
				return {$ref: `${this.prefix}${json.uri}`};
			} else if (json instanceof Date) {
				return {$date: json.getTime()};
			} else if (isArray(json)) {
				return json.map(item => this.toPotionJSON(item));
			} else {
				return omap(json, key => toSnakeCase(key), value => this.toPotionJSON(value), this);
			}
		} else {
			return json;
		}
	}

	private deserialize({data, headers}: PotionResponse): Promise<PotionResponse> {
		return this.fromPotionJSON(data)
			.then(json => ({
				headers,
				data: json
			}));
	}

	private fromPotionJSON(json: any): Promise<{[key: string]: any}> {
		const {Promise} = this;

		if (typeof json === 'object' && json !== null) {
			if (isArray(json)) {
				return Promise.all(json.map(item => this.fromPotionJSON(item)));
			} else if (typeof json.$uri === 'string') {
				// TODO: the json may also have {$type, $id} that can be used to recognize a resource
				// If neither combination is provided, it should throw and let the user now Flask Potion needs to be configured with one of these two strategies.

				return this.parseURI(json.$uri)
					.then(({resource, params, uri}) => {
						const properties: Map<string, any> = new Map();
						// Set the id
						const [id] = params;
						properties.set('$id', /^\d+$/.test(id) ? parseInt(id, 10) : id);
						const unpack = this.parsePotionJSONProperties(json, properties);

						// Create and cache the resource if it does not exist.
						if (!this.cache.has(uri)) {
							this.cache.put(uri, unpack.then((properties) => Reflect.construct(resource, [properties])));
						} else {
							// If the resource already exists,
							// update it with new properties.
							return Promise.all([unpack, this.cache.get(uri)])
								.then(([properties, item]) => {
									Object.assign(item, properties);
									return item;
								});
						}

						return this.cache.get(uri);
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

					return this.parseURI(json.$ref)
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

	private parsePotionJSONProperties(json: any, properties: Map<any, any> = new Map()): any {
		const {Promise} = this;
		const promises: Promise<any>[] = [];

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
