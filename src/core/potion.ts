/* tslint:disable:max-file-line-count */

import {decorateCtorWithPotionInstance, decorateCtorWithPotionURI, readonly} from './metadata';
import {ItemOptions, Item} from './item';
import {Store} from './store';
import {Pagination} from './pagination';
import {
	MemCache,
	toCamelCase,
	pairsToObject,
	toSnakeCase,
	omap,
	deepOmap
} from '../utils';


/**
 * Item cache.
 * Dictates the implementation of the item cache.
 */
export interface ItemCache<T extends Item> {
	get(key: string): T;
	put(key: string, item: T): T;
	remove(key: string): void;
}


/**
 * Common interfaces.
 */

export interface ParsedURI {
	uri: string;
	resource: Item;
	params: string[];
}

export interface URLSearchParams {
	[key: string]: any;
}

export interface RequestOptions {
	method?: string;
	search?: URLSearchParams | undefined | null;
	data?: any;
	cache?: boolean;
}

export interface FetchOptions extends RequestOptions {
	paginate?: boolean;
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
 *     static promise = Promise;
 *     protected request(uri, options?: RequestOptions): Promise<any> {
 *         // Here we need to implement the actual HTTP request
 *     };
 * }
 */
export abstract class PotionBase {
	static readonly promise: any = (window as any).Promise;
	readonly resources: {[key: string]: Item} = {};
	readonly cache: ItemCache<Item>;
	host: string;
	readonly prefix: string;

	private pendingGETRequests: Map<string, any> = new Map();

	constructor({host = '', prefix = '', cache}: PotionOptions = {}) {
		this.cache = cache || new MemCache();
		this.host = host;
		this.prefix = prefix;
	}

	fetch(uri: string, fetchOptions?: FetchOptions, paginationObj?: Pagination<any>): Promise<Item | Item[] | Pagination<Item> | any> {
		fetchOptions = fetchOptions || {};
		const {method, cache, paginate, data} = fetchOptions;
		let {search} = fetchOptions;
		const {promise} = (this.constructor as typeof PotionBase);
		const key = uri;

		// Add the API prefix if not present
		const {prefix} = this;
		if (uri.indexOf(prefix) === -1) {
			uri = `${prefix}${uri}`;
		}

		if (paginate) {
			// If no page was provided set to first
			// Default to 25 items per page
			search = fetchOptions.search = Object.assign({page: 1, perPage: 25}, search);
		}

		const fetch = () => {
			// Convert the {data, search} object props to snake case.
			// Serialize all values to Potion JSON.
			return this.request(`${this.host}${uri}`, Object.assign({}, fetchOptions, {
					search: search ? this.toPotionJSON(search) : null,
					data: data ? this.toPotionJSON(data) : null
				}))
				// Convert the data to Potion JSON
				.then(({data, headers}) => this.fromPotionJSON(data)
					.then((json) => ({headers, data: json})))
				.then(({headers, data}) => {
					// Return or update Pagination
					if (paginate) {
						const count = headers['x-total-count'] || data.length;

						if (!paginationObj) {
							return new Pagination<Item>({uri, potion: this}, data, count, fetchOptions);
						} else {
							paginationObj.update(data, count);
						}
					}

					return data;
				});
		};

		if (method === 'GET' && !search) {
			// If a GET request and {cache: true},
			// try to get item from cache,
			// and return a resolved promise with the cached item.
			// Note that queries are not cached.
			if  (cache) {
				const item = this.cache.get(key);
				if (item) {
					return promise.resolve(item);
				}
			}

			// If we already asked for the resource,
			// return the exiting pending request promise.
			if (this.pendingGETRequests.has(uri)) {
				return this.pendingGETRequests.get(uri);
			}

			const request = fetch().then((data) => {
				// Remove pending request
				this.pendingGETRequests.delete(uri);
				return data;
			}, (error) => {
				// If request fails,
				// make sure to remove the pending request so further requests can be made.
				// Return is necessary.
				this.pendingGETRequests.delete(uri);
				const message = error instanceof Error
					? error.message
					: typeof error === 'string'
						? error
						: `An error occurred while Potion tried to retrieve a resource from '${uri}'.`;
				return promise.reject(
					new Error(message)
				);
			});

			this.pendingGETRequests.set(uri, request);

			return request;
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
			options.readonly.forEach((property) => readonly(resource, property));
		}

		this.resources[uri] = resource;
		resource.store = new Store(resource);

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
	 * @returns {Object} An object with {data, headers} where {data} can be anything and {headers} is an object with the response headers from the HTTP request.
	 */
	protected abstract request(uri: string, options?: RequestOptions): Promise<any>;

	private parseURI(uri: string): ParsedURI {
		uri = decodeURIComponent(uri);

		if (uri.indexOf(this.prefix) === 0) {
			uri = uri.substring(this.prefix.length);
		}

		for (const [resourceURI, resource] of Object.entries(this.resources)) {
			if (uri.indexOf(`${resourceURI}/`) === 0) {
				return {
					uri,
					resource,
					params: uri.substring(resourceURI.length + 1)
						.split('/')
				};
			}
		}

		throw new Error(`URI '${uri}' is an uninterpretable or unknown potion resource.`);
	}

	private toPotionJSON(json: any): any {
		if (typeof json === 'object' && json !== null) {
			if (json instanceof (Item as any) && typeof json.uri === 'string') {
				return {$ref: `${this.prefix}${json.uri}`};
			} else if (json instanceof Date) {
				return {$date: json.getTime()};
			} else if (Array.isArray(json)) {
				return json.map((item) => this.toPotionJSON(item));
			} else {
				return omap(json, (key, value) => [toSnakeCase(key), this.toPotionJSON(value)]);
			}
		} else {
			return json;
		}
	}

	private fromPotionJSON(json: any): Promise<any> {
		const {promise} = (this.constructor as typeof PotionBase);
		if (typeof json === 'object' && json !== null) {
			if (Array.isArray(json)) {
				return promise.all(json.map((item) => this.fromPotionJSON(item)));
				// TODO: the json may also have {$type, $id} that can be used to recognize a resource
				// If neither combination is provided, it should throw and let the user now Flask Potion needs to be configured with one of these two strategies.
			} else if (typeof json.$uri === 'string') {
				// Try to parse the URI,
				// otherwise reject with the exception thrown from parseURI.
				let resource;
				let uri;
				try {
					const parsedURI = this.parseURI(json.$uri);
					resource = parsedURI.resource;
					uri = parsedURI.uri;
				} catch (parseURIError) {
					return promise.reject(parseURIError);
				}

				const promises: Promise<any>[] = [];

				// Cache the resource if it does not exist,
				// but do it before resolving any possible references (to other resources) on it.
				if (!this.cache.get(uri)) {
					this.cache.put(
						uri,
						// Create an empty instance
						Reflect.construct(resource as any, []) as any
					);
				}


				// Resolve possible references
				for (const key of Object.keys(json)) {
					if (key === '$uri') {
						promises.push(promise.resolve([key, uri]));
					} else {
						promises.push(this.fromPotionJSON(json[key])
								.then((value) => [toCamelCase(key), value]));
					}
				}


				return promise.all(promises)
					.then((propertyValuePairs) => {
						const properties: any = pairsToObject(propertyValuePairs);
						const obj = {};

						Object.keys(properties)
							.filter((key) => key !== '$uri')
							.forEach((key) => obj[key] = properties[key]);

						// Try to parse the URI,
						// otherwise reject with the exception thrown from parseURI.
						let params;
						let uri;
						try {
							const parsedURI = this.parseURI(properties.$uri);
							params = parsedURI.params;
							uri = parsedURI.uri;
						} catch (parseURIError) {
							return promise.reject(parseURIError);
						}

						Object.assign(obj, {
							$id: parseInt(params[0], 10),
							$uri: uri
						});

						// Try to get existing entry from cache
						let item = this.cache.get(uri);

						if (item) {
							Object.assign(item, obj);
						} else {
							item = Reflect.construct(resource as any, [obj]);
						}

						this.cache.put(uri, item as any);

						return item;
					});
			} else if (typeof json.$schema === 'string') {
				// If we have a schema object,
				// we want to resolve it as it is and not try to resolve references or do any conversions.
				// Though, we want to convert snake case to camel case.
				return promise.resolve(deepOmap(json, null, (key) => toCamelCase(key)));
			} else if (Object.keys(json).length === 1) {
				if (typeof json.$ref === 'string') {
					// Hack to not try to resolve self references.
					// TODO: we need to fix this in some way
					if (json.$ref === '#') {
						return promise.resolve(json.$ref);
					}

					// Try to parse the URI,
					// otherwise reject with the exception thrown from parseURI.
					let uri;
					try {
						const parsedURI = this.parseURI(json.$ref);
						uri = parsedURI.uri;
					} catch (parseURIError) {
						return promise.reject(parseURIError);
					}

					return this.fetch(uri, {
						cache: true,
						method: 'GET'
					});
				} else if (typeof json.$date !== 'undefined') {
					return promise.resolve(new Date(json.$date));
				}
			}

			const promises: Promise<any>[] = [];

			for (const key of Object.keys(json)) {
				promises.push(this.fromPotionJSON(json[key])
					.then((value) => [toCamelCase(key), value]));
			}

			return promise.all(promises)
				.then((propertyValuePairs) => pairsToObject(propertyValuePairs));
		} else {
			return promise.resolve(json);
		}
	}
}
