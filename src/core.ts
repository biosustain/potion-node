import {
	toSnakeCase,
	toCamelCase,
	pairsToObject,
	omap
} from './utils';


let Reflect = (window as any).Reflect; // tslint:disable-line:variable-name

// Make sure Reflect API is available,
// else throw an error.
// See https://github.com/angular/angular/blob/60727c4d2ba1e4b0b9455c767d0ef152bcedc7c2/modules/angular2/src/core/util/decorators.ts#L243
(function checkReflect(): void {
	if (!(Reflect && Reflect.getMetadata)) {
		throw 'reflect-metadata shim is required when using potion-node library';
	}
})();


const POTION_METADATA_KEY = Symbol('potion');
const POTION_URI_METADATA_KEY = Symbol('potion:uri');


/**
 * Mark a resource property as readonly and omit when saved.
 *
 * @example
 * class User extends Item {
 *     @readonly
 *     age;
 * }
 */
const READONLY_METADATA_KEY = Symbol('potion:readonly');
export function readonly(target: any, property: string): void {
	let constructor = typeof target === 'function'
		? target
		: typeof target.constructor === 'function'
			? target.constructor
			: null;

	if (constructor === null) {
		// TODO: maybe throw an error here
		return;
	}

	Reflect.defineMetadata(
		READONLY_METADATA_KEY,
		Object.assign(Reflect.getOwnMetadata(READONLY_METADATA_KEY, constructor) || {}, {[property]: true}),
		constructor
	);
}


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
 * Common Interfaces
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
	search?: URLSearchParams;
	data?: any;
	cache?: boolean;
}

export interface FetchOptions extends RequestOptions {
	paginate?: boolean;
}

export interface PaginationOptions {
	page?: number;
	perPage?: number;
}

export interface QueryOptions extends PaginationOptions {
	where?: any;
	sort?: any;
}

export interface ItemOptions {
	'readonly'?: string[];
}


/**
 * Item
 */

export interface ItemConstructor {
	new (object: any): Item;
	store?: Store<Item>;
}

/**
 * Base resource class for API resources.
 * Extending this class will make all resource operations available on the child class.
 * Note that this is an abstract class and cannot be directly initiated.
 *
 * @example
 * class User extends Item {}
 *
 * User.fetch(1).then((user) => {
 *     user.update({name: 'John Doe'});
 * });
 *
 * let fred = new User({name: 'Fred'});
 * fred.save();
 *
 * User.query().then((users) => {
 *     users[0].destroy();
 * });
 */
export abstract class Item {
	static store: Store<any>;

	private _id: number = null;
	private _uri: string;

	/**
	 * Create an instance of the class that extended the Item.
	 * @param {Object} properties - An object with any properties that will be added and accessible on the resource.
	 */
	constructor(properties: any = {}) {
		Object.assign(this, properties);
	}

	get id(): number {
		return this._id;
	}
	set id(id: number) {
		this._id = id;
	}

	get uri(): string {
		return this._uri;
	}
	set uri(uri: string) {
		this._uri = uri;
	}

	save(): Promise<Item> {
		return (this.constructor as typeof Item).store.save(this.toJSON());
	}

	/**
	 * Update the resource.
	 * @param {Object} properties - An object with any properties to update.
	 */
	update(properties: any = {}): Promise<Item> {
		return (this.constructor as typeof Item).store.update(this, properties);
	}

	destroy(): Promise<Item> {
		return (this.constructor as typeof Item).store.destroy(this);
	}

	toJSON(): any {
		let properties = {};
		let metadata = Reflect.getOwnMetadata(READONLY_METADATA_KEY, this.constructor);

		Object
			.keys(this)
			.filter((key) => !key.startsWith('_') && (!metadata || (metadata && !metadata[key])))
			.forEach((key) => {
				properties[toSnakeCase(key)] = this[key];
			});

		return properties;
	}

	/**
	 * Get a resource by id.
	 * @param {Number|String} id
	 * @param {FetchOptions} fetchOptions - Setting {cache: true} will ensure that the item will be fetched from cache if it exists and the HTTP request is cached.
	 */
	static fetch(id: number, fetchOptions?: FetchOptions): Promise<Item> {
		return this.store.fetch(id, fetchOptions);
	}

	/**
	 * Query resources.
	 * @param {QueryOptions} queryOptions - Can be used to manipulate the pagination with {page: number, perPage: number},
	 * but it can also be used to further filter the results with {sort: any, where: any}.
	 * @param {FetchOptions} fetchOptions - Setting {paginate: true} will result in the return value to be a Pagination object.
	 * Caching it this case will only apply for the HTTP request.
	 */
	static query(queryOptions?: QueryOptions, fetchOptions?: FetchOptions): Promise<Item[] | Pagination<Item>> {
		return this.store.query(queryOptions, fetchOptions);
	}

	/**
	 * Get the first item.
	 */
	static first(queryOptions?: QueryOptions): Promise<Item> {
		return this.store
			.query(queryOptions)
			.then((items) => items[0]);
	}
}


export class Store<T extends Item> {
	cache: ItemCache<Item>;
	promise: any;

	private itemConstructor: ItemConstructor;

	constructor(itemConstructor: ItemConstructor) {
		this.itemConstructor = itemConstructor;

		let potion: PotionBase = Reflect.getOwnMetadata(POTION_METADATA_KEY, itemConstructor);

		this.promise = (potion.constructor as typeof PotionBase).promise;
		this.cache = potion.cache;

	}

	fetch(id: number, {cache = true}: FetchOptions = {}): Promise<T> {
		return Reflect
			.getOwnMetadata(POTION_METADATA_KEY, this.itemConstructor)
			.fetch(`${Reflect.getOwnMetadata(POTION_URI_METADATA_KEY, this.itemConstructor)}/${id}`, {cache, method: 'GET'});
	}

	query(queryOptions?: QueryOptions, {paginate = false, cache = true}: FetchOptions = {}, paginationObj?: Pagination<T>): Promise<T[] | Pagination<T> | any> {
		return Reflect
			.getOwnMetadata(POTION_METADATA_KEY, this.itemConstructor)
			.fetch(
				Reflect.getOwnMetadata(POTION_URI_METADATA_KEY, this.itemConstructor),
				{
					paginate,
					cache,
					method: 'GET',
					search: queryOptions
				},
				paginationObj
			);
	}

	update(item: Item, data: any = {}): Promise<T> {
		return Reflect
			.getOwnMetadata(POTION_METADATA_KEY, this.itemConstructor)
			.fetch(item.uri, {data, cache: true, method: 'PATCH'});
	}

	save(data: any = {}): Promise<T> {
		return Reflect
			.getOwnMetadata(POTION_METADATA_KEY, this.itemConstructor)
			.fetch(Reflect.getOwnMetadata(POTION_URI_METADATA_KEY, this.itemConstructor), {data, cache: true, method: 'POST'});
	}

	destroy(item: Item): Promise<T> {
		let {uri} = item;

		return Reflect
			.getOwnMetadata(POTION_METADATA_KEY, this.itemConstructor)
			.fetch(uri, {method: 'DELETE'})
			.then(() => {
				// Clear the item from cache if exists
				if (this.cache && this.cache.get && this.cache.get(uri)) {
					this.cache.remove(uri);
				}
			});
	}
}


export function route<T>(path: string, {method}: RequestOptions = {}): (params?: any, options?: FetchOptions) => Promise<T> {
	return function (params?: any, {paginate = false, cache = true}: FetchOptions = {}): Promise<T> {
		let isCtor = typeof this === 'function';
		let uri = `${isCtor ? Reflect.getOwnMetadata(POTION_URI_METADATA_KEY, this) : this.uri}${path}`;

		let options: FetchOptions = {method, paginate, cache};
		if (method === 'GET') {
			options.search = params;
		} else if ((['POST', 'PUT', 'PATCH'] as any).includes(method)) {
			options.data = params;
		}

		return Reflect
			.getOwnMetadata(POTION_METADATA_KEY, isCtor ? this : this.constructor)
			.fetch(uri, options);
	};
}

/**
 * Use the Route object methods to register other REST methods on a resource.
 *
 * @example
 * class User extends Item {
 *     static readSiblings = Route.GET('/siblings');
 *     createSibling = Route.POST('/sibling');
 * }
 */
// tslint:disable-next-line:variable-name
export let Route = {
	GET<T>(uri: string): (params?: any, options?: FetchOptions) => Promise<T> {
		return route<T>(uri, {method: 'GET'});
	},
	DELETE<T>(uri: string): (params?: any, options?: FetchOptions) => Promise<T> {
		return route<T>(uri, {method: 'DELETE'});
	},
	POST<T>(uri: string): (params?: any, options?: FetchOptions) => Promise<T> {
		return route<T>(uri, {method: 'POST'});
	},
	PATCH<T>(uri: string): (params?: any, options?: FetchOptions) => Promise<T> {
		return route<T>(uri, {method: 'PATCH'});
	},
	PUT<T>(uri: string): (params?: any, options?: FetchOptions) => Promise<T> {
		return route<T>(uri, {method: 'PUT'});
	}
};


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
	static promise: any = (window as any).Promise;
	resources: {[key: string]: Item} = {};
	cache: ItemCache<Item>;
	host: string;
	prefix: string;

	private pendingGETRequests: Map<string, any> = new Map();

	constructor({host = '', prefix = '', cache}: PotionOptions = {}) {
		this.host = host;
		this.prefix = prefix;
		this.cache = cache;
	}

	fetch(uri: string, fetchOptions?: FetchOptions, paginationObj?: Pagination<any>): Promise<Item | Item[] | Pagination<Item> | any> {
		fetchOptions = fetchOptions || {};
		let {method, cache, search, paginate, data} = fetchOptions;
		let {promise} = (this.constructor as typeof PotionBase);
		let key = uri;

		// Add the API prefix if not present
		let {prefix} = this;
		if (uri.indexOf(prefix) === -1) {
			uri = `${prefix}${uri}`;
		}

		if (paginate) {
			// If no page was provided set to first
			// Default to 25 items per page
			search = fetchOptions.search = Object.assign({page: 1, perPage: 25}, search);
		}

		let fetch = () => {
			return this
				// Convert the {data, search} object props to snake case.
				// Serialize all values to Potion JSON.
				.request(`${this.host}${uri}`, Object.assign({}, fetchOptions, {
					search: search ? this.toPotionJSON(search) : null,
					data: data ? this.toPotionJSON(data) : null
				}))
				// Convert the data to Potion JSON
				.then(({data, headers}) => this.fromPotionJSON(data).then((json) => ({headers, data: json})))
				.then(({headers, data}) => {
					// Return or update Pagination
					if (paginate) {
						let count = headers['x-total-count'] || data.length;

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
			if  (cache && this.cache && this.cache.get) {
				let item = this.cache.get(key);
				if (item) {
					return promise.resolve(item);
				}
			}

			// If we already asked for the resource,
			// return the exiting pending request promise.
			if (this.pendingGETRequests.has(uri)) {
				return this.pendingGETRequests.get(uri);
			}

			let request = fetch().then(
				(data) => {
					// Remove pending request
					this.pendingGETRequests.delete(uri);
					return data;
				},
				() => {
					// If request fails,
					// make sure to remove the pending request so further requests can be made.
					// Return is necessary.
					this.pendingGETRequests.delete(uri);
					return promise.reject();
				}
			);

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
		Reflect.defineMetadata(POTION_METADATA_KEY, this, resource);
		Reflect.defineMetadata(POTION_URI_METADATA_KEY, uri, resource);

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

		for (let [resourceURI, resource] of (Object as any).entries(this.resources)) {
			if (uri.indexOf(`${resourceURI}/`) === 0) {
				return {uri, resource, params: uri.substring(resourceURI.length + 1).split('/')};
			}
		}

		throw new Error(`Uninterpretable or unknown resource URI: ${uri}`);
	}

	private toPotionJSON(json: any): any {
		if (typeof json === 'object' && json !== null) {
			if (json instanceof Item && typeof json.uri === 'string') {
				return {$ref: `${this.prefix}${json.uri}`};
			} else if (json instanceof Date) {
				return {$date: json.getTime()};
			} else if (json instanceof Array) {
				return json.map((item) => this.toPotionJSON(item));
			} else {
				return omap(json, (key, value) => [toSnakeCase(key), this.toPotionJSON(value)]);
			}
		} else {
			return json;
		}
	}

	private fromPotionJSON(json: any): Promise<any> {
		let {promise} = (this.constructor as typeof PotionBase);
		if (typeof json === 'object' && json !== null) {
			if (json instanceof Array) {
				return promise.all(json.map((item) => this.fromPotionJSON(item)));
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

				let promises = [];

				// Cache the resource if it does not exist,
				// but do it before resolving any possible references (to other resources) on it.
				if (this.cache && this.cache.get && !this.cache.get(uri)) {
					this.cache.put(
						uri,
						// Create an empty instance
						Reflect.construct(resource as any, []) as any
					);
				}


				// Resolve possible references
				for (let key of Object.keys(json)) {
					if (key === '$uri') {
						promises.push(promise.resolve([key, uri]));
					} else {
						promises.push(this.fromPotionJSON(json[key]).then((value) => [toCamelCase(key), value]));
					}
				}


				return promise
					.all(promises)
					.then((propertyValuePairs) => {
						let properties: any = pairsToObject(propertyValuePairs);
						let obj = {};

						Object
							.keys(properties)
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

						Object.assign(obj, {uri, id: parseInt(params[0], 10)});

						let item;
						// Try to get existing entry from cache
						if (this.cache && this.cache.get) {
							item = this.cache.get(uri);
						}

						if (item) {
							Object.assign(item, obj);
						} else {
							item = Reflect.construct(resource as any, [obj]);
						}

						if (this.cache && this.cache.put) {
							this.cache.put(uri, item as any);
						}

						return item;
					});
			} else if (Object.keys(json).length === 1) {
				if (typeof json.$ref === 'string') {
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

			let promises = [];

			for (let key of Object.keys(json)) {
				promises.push(this.fromPotionJSON(json[key]).then((value) => [toCamelCase(key), value]));
			}

			return promise
				.all(promises)
				.then((propertyValuePairs) => pairsToObject(propertyValuePairs));
		} else {
			return promise.resolve(json);
		}
	}
}


/**
 * Array like class with resources.
 * The class is returned when the {paginate} option is set to `true` when a query is made.
 * It implements the [Iterator](https://basarat.gitbooks.io/typescript/content/docs/iterators.html) which means that `for..of` and `.next()` can be used to iterate over the items.
 *
 * @example
 * class User extends Item {}
 *
 * User.query(null, {paginate: true}).then((users) => {
 *     for (let user of users) {
 *         console.log(user);
 *     }
 * });
 */
export class Pagination<T extends Item> {
	private potion: PotionBase;
	private uri: string;
	private options: FetchOptions;

	private items: T[] = [];

	private _page: number;
	private _perPage: number;
	private _total: number;

	constructor({potion, uri}: {potion: PotionBase, uri: string}, items: T[], count: string, options: FetchOptions) {
		this.potion = potion;
		this.uri = uri;
		this.options = options;

		this.items.push(...items);

		let {page, perPage} = options.search;
		this._page = page;
		this._perPage = perPage;
		this._total = parseInt(count, 10);
	}

	[Symbol.iterator](): IterableIterator<T> {
		return this.items.values();
	}

	get page(): number {
		return this._page;
	}
	// Setting the page will trigger a new query and update the items.
	set page(page: number) {
		this.changePageTo(page);
	}

	get perPage(): number {
		return this._perPage;
	}

	get pages(): number {
		return Math.ceil(this._total / this._perPage);
	}

	get total(): number {
		return this._total;
	}

	get length(): number {
		return this.items.length;
	}

	changePageTo(page: number): Promise<T | T[] | Pagination<T> | any> {
		(this.options.search as any).page = page;
		this._page = page;
		return this.potion.fetch(this.uri, this.options, this);
	}

	update(items: T[], count: number): void {
		this.items.splice(0, this.length, ...items);
		this._total = count;
	}

	toArray(): T[] {
		return this.items;
	}
}
