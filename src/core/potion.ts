/* tslint:disable:max-file-line-count */
import {
	decorateCtorWithPotionInstance,
	decorateCtorWithPotionURI,
	potionPromise,
	readonly
} from './metadata';
import {Item, ItemConstructor, ItemOptions} from './item';
import {Pagination} from './pagination';
import {
	addPrefixToURI,
	findPotionResource,
	findRoots,
	fromSchemaJSON,
	getErrorMessage,
	getPotionID,
	getPotionURI,
	hasTypeAndId,
	isFunction,
	isPotionURI,
	MemCache,
	parsePotionID,
	removePrefixFromURI,
	replaceSelfReferences,
	toCamelCase,
	toPotionJSON,
	toSelfReference
} from './utils';


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
	resource: ItemConstructor;
	id: string | number | null;
	uri: string;
}

// TODO: Start using a more standard impl. of these interfaces (either create proper classes for some or use the native Request, etc.)
export interface URLSearchParams {
	[key: string]: any;
}

export interface RequestOptions {
	method?: string;
	search?: URLSearchParams | QueryOptions | null;
	data?: any;
	cache?: boolean;
	paginate?: boolean;
}
export interface QueryOptions {
	page?: number;
	perPage?: number;
	where?: any;
	sort?: any;
}

export interface FetchExtras {
	pagination?: Pagination<any>;
	origin?: string[];
}

export type FetchOptions = RequestOptions & FetchExtras;


export interface PotionResponse {
	data: any;
	headers: any;
}

export interface PotionOptions {
	host?: string;
	prefix?: string;
	cache?: ItemCache<Item>;
}

export interface PotionResources {
	[key: string]: ItemConstructor;
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
	readonly resources: PotionResources = {};
	readonly cache: ItemCache<Item>;
	host: string;
	readonly prefix: string;

	private readonly Promise: typeof Promise = potionPromise(this); // NOTE: This is needed only to provide support for AngularJS.
	private requests: Map<string, any> = new Map();

	constructor({host = '', prefix = '', cache}: PotionOptions = {}) {
		this.cache = cache || new MemCache();
		this.host = host;
		this.prefix = prefix;
	}

	/**
	 * Register a resource.
	 * @param uri - Path on which the resource is registered.
	 * @param resource
	 * @param options - Set the property options for any instance of the resource (setting a property to readonly for instance).
	 */
	register(uri: string, resource: ItemConstructor, options?: ItemOptions): ItemConstructor {
		if (!isFunction(resource)) {
			throw new TypeError(`An error occurred while trying to register a resource for ${uri}. ${resource} is not a function.`);
		}
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
	 * @param uri - Path on which the resource is registered.
	 * @param options - Set the property options for any instance of the resource (setting a property to readonly for instance).
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
	 * @param uri
	 * @param options
	 * @returns An object with {data, headers} where {data} can be anything and {headers} is an object with the response headers from the HTTP request.
	 */
	protected abstract request(uri: string, options?: RequestOptions): Promise<PotionResponse>;

	// tslint:disable-next-line: member-ordering
	fetch(uri: string, requestOptions?: RequestOptions, extras?: FetchExtras): Promise<Item | Item[] | Pagination<Item> | any> {
		const origin = removePrefixFromURI(uri, this.prefix);
		const options = {...requestOptions, ...extras, origin: []};
		if (isPotionURI(uri, this.resources)) {
			Object.assign(options, {
				origin: [origin]
			});
		}
		return this.resolve(uri, options)
			.then(json => {
				replaceSelfReferences(json, findRoots(json));
				return json;
			});
	}

	private resolve(uri: string, options: FetchOptions): Promise<any> {
		const {Promise, prefix} = this;

		const cacheKey = removePrefixFromURI(uri, prefix);
		// Add the API prefix if not present
		uri = addPrefixToURI(uri, prefix);

		// Serialize request to Potion JSON.
		const fetch = () => this.request(`${this.host}${uri}`, this.serialize(options))
			// Deserialize the Potion JSON.
			.then(response => this.deserialize(response, uri, options));

		if (options.method === 'GET' && !options.paginate && !options.search) {
			// If a GET request was made and {cache: true} return the item from cache (if it exists).
			// NOTE: Queries are not cached.
			if  (options.cache && this.cache.has(cacheKey)) {
				return this.cache.get(cacheKey);
			}

			// Cache the request so that further requests for the same resource will not make an aditional XHR.
			if (!this.requests.has(cacheKey)) {
				this.requests.set(cacheKey, fetch().then(data => {
					this.requests.delete(cacheKey);
					return data;
				}, err => {
					// If request fails,
					// make sure to remove the pending request so further requests can be made,
					// but fail the pipeline.
					this.requests.delete(cacheKey);
					const message = getErrorMessage(err, uri);
					return Promise.reject(message);
				}));
			}

			return this.requests.get(cacheKey);
		} else {
			return fetch();
		}

	}

	private serialize(options: FetchOptions): FetchOptions {
		const {prefix} = this;
		const {search} = options;

		return {
			...options,
			...{
				search: toPotionJSON(options.paginate ? {page: 1, perPage: 25, ...search} : search, prefix),
				data: toPotionJSON(options.data, prefix)
			}
		};
	}
	private deserialize({data, headers}: PotionResponse, uri: string, options: FetchOptions): Promise<PotionResponse> {
		return this.fromPotionJSON(data, options.origin as string[])
			.then(json => {
				// If {paginate} is enabled, return or update Pagination.
				if (options.paginate) {
					const count = headers['x-total-count'] || json.length;
					if (options.pagination instanceof Pagination) {
						return options.pagination.update(json, count);
					} else {
						const pagination = new Pagination<Item>({uri, potion: this}, json, count, options);
						Object.assign(options, {pagination});
						return pagination;
					}
				}
				return json;
			});
	}

	private fromPotionJSON(json: any, origin: string[]): Promise<any> {
		const {Promise} = this;

		if (typeof json === 'object' && json !== null) {
			if (Array.isArray(json)) {
				return Promise.all(json.map(item => this.fromPotionJSON(item, origin)));
			} else if (typeof json.$uri === 'string' || hasTypeAndId(json)) {
				// NOTE: The json may also have {$type, $id} that can be used to recognize a resource instead of {$uri}.
				// If neither combination is provided it will throw.
				return this.parseURI(json)
					.then(({resource, id, uri}) => {
						const attrs = {$id: id, $uri: uri};

						// Since we have a resource, we append to origin list (because later it will get replaced with itself).
						if (!origin.includes(uri)) {
							origin.push(uri);
						}

						const properties = this.parsePotionJSONProperties(json, origin);

						// Create and cache the resource if it does not exist.
						if (!this.cache.has(uri)) {
							return this.cache.put(uri, properties.then((properties: {}) => Reflect.construct(resource, [{...properties, ...attrs}])));
						} else {
							// If the resource already exists,
							// update it with new properties.
							return Promise.all([properties, this.cache.get(uri)])
								.then(([properties, item]) => {
									Object.assign(item, properties, attrs);
									return item;
								});
						}
					});
			} else if (typeof json.$schema === 'string') {
				// If we have a schema object,
				// we want to resolve it as it is and not try to resolve references or do any conversions.
				// Though, we want to convert snake case to camel case.
				return Promise.resolve(fromSchemaJSON(json));
			} else if (Object.keys(json).length === 1) {
				if (typeof json.$ref === 'string') {
					if (json.$ref === '#') {
						return Promise.resolve(json.$ref);
					}

					return this.parseURI(json)
						.then(({uri}) => {
							if (origin.includes(uri)) {
								return Promise.resolve(toSelfReference(uri));
							}
							return this.resolve(uri, {
								cache: true,
								method: 'GET',
								origin
							});
						});
				} else if (typeof json.$date !== 'undefined') {
					// Parse Potion date
					return Promise.resolve(new Date(json.$date));
				}
			}

			return this.parsePotionJSONProperties(json, origin);
		} else {
			return Promise.resolve(json);
		}
	}
	private parsePotionJSONProperties(json: any, origin: string[]): any {
		const {Promise} = this;
		const entries = Object.entries(json);
		const values = entries.map(([, value]) => this.fromPotionJSON(value, origin));
		const keys = entries.map(([key]) => toCamelCase(key));

		return Promise.all(values)
			.then(values => values.map((value, index) => [keys[index], value])
				.reduce((a, [key, value]) => Object.assign(a, {
					[key]: value
				}), {}));
	}

	// Try to parse a Potion URI and find the associated resource for it,
	// otherwise return a rejected promise.
	private parseURI({$ref, $uri, $type, $id}: {[key: string]: any}): Promise<ParsedURI> {
		const {Promise} = this;
		const uri = removePrefixFromURI(getPotionURI({$ref, $uri, $type, $id}), this.prefix);
		const entry = findPotionResource(uri, this.resources);

		if (!entry) {
			return Promise.reject(new Error(`URI '${uri}' is an uninterpretable or unknown Potion resource.`));
		} else {
			const {resourceURI, resource} = entry;
			const params = {resource, uri, id: parsePotionID($id)};

			if (params.id === null) {
				Object.assign(params, {
					id: getPotionID(uri, resourceURI)
				});
			}

			return Promise.resolve(params);
		}
	}
}
