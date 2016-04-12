import {
	fromCamelCase,
	toCamelCase,
	pairsToObject
} from './utils';


/* tslint:disable: variable-name */
let Reflect = (<any>window).Reflect || {};
/* tslint:enable: variable-name */

if (!Reflect.getMetadata) {
	throw 'reflect-metadata shim is required and is missing';
}


let _potionMetadataKey = Symbol('potion');
let _potionURIMetadataKey = Symbol('potion:uri');


/**
 * @readonly decorator
 */

let _readonlyMetadataKey = Symbol('potion:readonly');
export function readonly(target, property) {
	let metadata = Reflect.getMetadata(_readonlyMetadataKey, target.constructor);
	Reflect.defineMetadata(_readonlyMetadataKey, Object.assign(metadata || {}, {[property]: true}), target.constructor);
}


export interface PotionRequestOptions {
	method?: 'GET' | 'PUT' | 'PATCH' | 'DELETE' | 'POST';
	cache?: boolean;
	data?: any;
}


export interface PotionItemCache<T extends Item> {
	get(key: string): T;
	put(key: string, item: T): T;
	remove(key: string): void;
}


export interface PaginationOptions {
	paginate?: boolean;
	page?: number;
	perPage?: number;
}


export interface ItemConstructor {
	new (object: any): Item;
	store?: Store<Item>;
}

export interface ItemOptions {
	'readonly'?: string[];
}

export interface ItemFetchOptions extends PaginationOptions {
	cache?: boolean;
}

export class Item {
	static store: Store<any>;
	id = null;
	uri: string;

	static fetch(id, options?: ItemFetchOptions): Promise<Item> {
		return this.store.fetch(id, options);
	}

	static query(options?: ItemFetchOptions): Promise<Item[] | Pagination<Item>> {
		return this.store.query(options);
	}

	constructor(properties: any = {}, options?: ItemOptions) {
		Object.assign(this, properties);

		if (options && Array.isArray(options.readonly)) {
			options.readonly.forEach((property) => readonly(this, property));
		}
	}

	save(options?: ItemFetchOptions): Promise<Item> {
		return (<typeof Item>this.constructor).store.save(this.toJSON(), options);
	}

	update(properties: any = {}, options?: ItemFetchOptions): Promise<Item> {
		return (<typeof Item>this.constructor).store.update(this, properties, options);
	}

	destroy(): Promise<Item> {
		return (<typeof Item>this.constructor).store.destroy(this);
	}

	toJSON() {
		let properties = {};
		let metadata = Reflect.getMetadata(_readonlyMetadataKey, this.constructor);

		Object
			.keys(this)
			.filter((key) => !metadata || (metadata && !metadata[key]))
			.forEach((key) => {
				properties[fromCamelCase(key)] = this[key];
			});

		return properties;
	}
}


export class Store<T extends Item> {
	cache: PotionItemCache<Item>;
	promise;

	private _itemConstructor: ItemConstructor;
	private _promises = [];

	constructor(itemConstructor: ItemConstructor) {
		this._itemConstructor = itemConstructor;

		let potion = Reflect.getMetadata(_potionMetadataKey, itemConstructor);

		this.promise = (<typeof PotionBase>potion.constructor).promise;
		this.cache = potion.cache;

	}

	fetch(id, {cache = true}: ItemFetchOptions = {}): Promise<T> {
		let uri = `${Reflect.getMetadata(_potionURIMetadataKey, this._itemConstructor)}/${id}`;

		// Try to get from cache
		if (cache && this.cache && this.cache.get) {
			let item = this.cache.get(uri);
			if (item) {
				return this.promise.resolve(item);
			}
		}

		// If we already asked for the resource,
		// return the exiting promise.
		let promise = this._promises[uri];
		if (promise) {
			return promise;
		}

		// Register a pending request,
		// get the data,
		// and parse it.
		// Enforce GET method
		promise = this._promises[uri] = Reflect
			.getMetadata(_potionMetadataKey, this._itemConstructor)
			.fetch(uri, {cache, method: 'GET'})
			.then((item) => {
				delete this._promises[uri]; // Remove pending request
				return item;
			});

		return promise;
	}

	query({paginate = false, cache = true, page = 1, perPage = 5}: ItemFetchOptions = {}, paginationObj?: Pagination<T>): Promise<T[] | Pagination<T> | any> {
		let options: PotionRequestOptions = {cache, method: 'GET'};

		if (paginate) {
			Object.assign(options, {data: {page, perPage}});
		}

		return Reflect.getMetadata(_potionMetadataKey, this._itemConstructor).fetch(Reflect.getMetadata(_potionURIMetadataKey, this._itemConstructor), options, paginationObj);
	}

	update(item: Item, data: any = {}, {cache = true}: ItemFetchOptions = {}): Promise<T> {
		return Reflect.getMetadata(_potionMetadataKey, this._itemConstructor).fetch(item.uri, {data, cache, method: 'PATCH'});
	}

	save(data: any = {}, {cache = true}: ItemFetchOptions = {}): Promise<T> {
		return Reflect.getMetadata(_potionMetadataKey, this._itemConstructor).fetch(Reflect.getMetadata(_potionURIMetadataKey, this._itemConstructor), {data, cache, method: 'POST'});
	}

	destroy(item: Item): Promise<T> {
		let {uri} = item;

		return Reflect
			.getMetadata(_potionMetadataKey, this._itemConstructor)
			.fetch(uri, {method: 'DELETE'})
			.then(() => {
				// Clear the item from cache if exists
				if (this.cache && this.cache.get && this.cache.get(uri)) {
					this.cache.remove(uri);
				}
			});
	}
}


export function route<T>(uri: string, {method}: PotionRequestOptions = {}): (options?: ItemFetchOptions) => Promise<T> {
	return function (options?: ItemFetchOptions): any {
		let isCtor = typeof this === 'function';
		uri = `${isCtor ? Reflect.getMetadata(_potionURIMetadataKey, this) : this.uri}${uri}`;
		return Reflect.getMetadata(_potionMetadataKey, isCtor ? this : this.constructor).fetch(uri, Object.assign({method}, options));
	};
}


/* tslint:disable: variable-name */
export let Route = {
	GET<T>(uri: string) {
		return route<T>(uri, {method: 'GET'});
	},
	DELETE<T>(uri: string) {
		return route<T>(uri, {method: 'DELETE'});
	},
	POST<T>(uri: string) {
		return route<T>(uri, {method: 'POST'});
	},
	PATCH<T>(uri: string) {
		return route<T>(uri, {method: 'PATCH'});
	},
	PUT<T>(uri: string) {
		return route<T>(uri, {method: 'PUT'});
	}
};
/* tslint:enable: variable-name */


export interface PotionOptions {
	prefix?: string;
	cache?: PotionItemCache<Item>;
}

export abstract class PotionBase {
	static promise = (<any>window).Promise;
	resources = {};
	cache: PotionItemCache<Item>;
	prefix: string;

	constructor({prefix = '', cache}: PotionOptions = {}) {
		this.prefix = prefix;
		this.cache = cache;
	}

	parseURI(uri: string) {
		uri = decodeURIComponent(uri);

		if (uri.indexOf(this.prefix) === 0) {
			uri = uri.substring(this.prefix.length);
		}

		for (let [resourceURI, resource] of (<any>Object).entries(this.resources)) {
			if (uri.indexOf(`${resourceURI}/`) === 0) {
				return {uri, resource, params: uri.substring(resourceURI.length + 1).split('/')};
			}
		}

		throw new Error(`Uninterpretable or unknown resource URI: ${uri}`);
	}

	abstract request(uri, options?: PotionRequestOptions): Promise<any>;

	fetch(uri, options?: PotionRequestOptions, paginationObj?: Pagination<any>): Promise<Item | Item[] | Pagination<Item> | any> {
		// Add the API prefix if not present
		let {prefix} = this;
		if (uri.indexOf(prefix) === -1) {
			uri = `${prefix}${uri}`;
		}

		return this
			.request(uri, options)
			.then(({data, headers}) => this._fromPotionJSON(data).then((json) => ({headers, data: json})))
			.then(({headers, data}) => {
				let {page = null, perPage = null} = options && options.data ? options.data : {};

				if (page || perPage) {
					let count = headers['x-total-count'] || data.length;

					if (paginationObj) {
						paginationObj.update(data, count);
					} else {
						return new Pagination<Item>({uri, potion: this}, data, count, options);
					}
				}

				return data;
			});
	}

	register(uri: string, resource: any) {
		Reflect.defineMetadata(_potionMetadataKey, this, resource);
		Reflect.defineMetadata(_potionURIMetadataKey, uri, resource);

		this.resources[uri] = resource;
		resource.store = new Store(resource);
	}

	registerAs(uri: string): ClassDecorator {
		return (target: any) => {
			this.register(uri, target);
			return target;
		};
	}

	private _fromPotionJSON(json: any): Promise<any> {
		let {promise} = (<typeof PotionBase>this.constructor);
		if (typeof json === 'object' && json !== null) {
			if (json instanceof Array) {
				return promise.all(json.map((item) => this._fromPotionJSON(item)));
			} else if (typeof json.$uri === 'string') {
				let {resource, uri} = this.parseURI(json.$uri);
				let promises = [];

				for (let key of Object.keys(json)) {
					if (key === '$uri') {
						promises.push(promise.resolve([key, uri]));
					} else {
						promises.push(this._fromPotionJSON(json[key]).then((value) => {
							return [toCamelCase(key), value];
						}));
					}
				}

				return promise.all(promises).then((propertyValuePairs) => {
					let properties: any = pairsToObject(propertyValuePairs);
					let obj = {};

					Object
						.keys(properties)
						.filter((key) => key !== '$uri')
						.forEach((key) => obj[key] = properties[key]);

					let {params, uri} = this.parseURI(properties.$uri);
					Object.assign(obj, {uri, id: parseInt(params[0], 10)});

					let item = Reflect.construct(<any>resource, [obj]);
					if (this.cache && this.cache.put) {
						this.cache.put(uri, <any>item);
					}

					return item;
				});
			} else if (Object.keys(json).length === 1) {
				if (typeof json.$ref === 'string') {
					let {uri} = this.parseURI(json.$ref);

					// Try to get from cache
					if (this.cache && this.cache.get) {
						let item = this.cache.get(uri);
						if (item) {
							return promise.resolve(item);
						}
					}

					return this.fetch(uri);
				} else if (typeof json.$date !== 'undefined') {
					return promise.resolve(new Date(json.$date));
				}
			}

			let promises = [];

			for (let key of Object.keys(json)) {
				promises.push(this._fromPotionJSON(json[key]).then((value) => {
					return [toCamelCase(key), value];
				}));
			}

			return promise.all(promises).then((propertyValuePairs) => {
				return pairsToObject(propertyValuePairs);
			});
		} else {
			return promise.resolve(json);
		}
	}
}


export class Pagination<T extends Item> {
	get page() {
		return this._page;
	}

	set page(page) {
		this._page = page;
		Object.assign(this._options, {
			data: Object.assign(this._options.data, {page})
		});
		this._potion.fetch(this._uri, this._options, this).then(() => {
			this._subscribers.forEach((subscriber) => {
				subscriber(this);
			});
		});
	}

	get perPage() {
		return this._perPage;
	}

	get pages() {
		return Math.ceil(this._total / this._perPage);
	}

	get length() {
		return this._items.length;
	}

	private _potion: PotionBase;
	private _uri: string;
	private _options: PotionRequestOptions;
	private _subscribers = [];

	private _items: T[] = [];

	private _page: number;
	private _perPage: number;
	private _total: number;

	constructor({potion, uri}, items, count, options: PotionRequestOptions) {
		this._potion = potion;
		this._uri = uri;
		this._options = options;

		this._items.push(...items);

		let {page, perPage} = options.data;
		this._page = page;
		this._perPage = perPage;
		this._total = parseInt(count);
	}

	[Symbol.iterator]() {
		return this._items.values();
	}

	update(items, count) {
		this._items.splice(0, this.length, ...items);
		this._total = count;
	}

	subscribe(cb: (pagination: Pagination<T>) => void) {
		this._subscribers.push(cb);
	}

	toArray(): T[] {
		return this._items;
	}
}
