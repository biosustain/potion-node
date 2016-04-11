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


export interface ItemConstructor {
	new (object: any): Item;
	store?: Store<Item>;
}

export interface ItemOptions {
	'readonly'?: string[];
}

export interface ItemFetchOptions {
	cache?: boolean;
}

export class Item {
	static store: Store<any>;
	id = null;
	uri: string;

	static fetch(id, options?: ItemFetchOptions): Promise<Item> {
		return this.store.fetch(id, options);
	}

	static query(options?: ItemFetchOptions): Promise<Item[]> {
		return this.store.query(options);
	}

	static create(...args) {
		return Reflect.construct(this, args);
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

		Object
			.keys(this)
			.filter((key) => {
				let metadata = Reflect.getMetadata(_readonlyMetadataKey, this.constructor);
				return (!metadata || (metadata && !metadata[key]));
			})
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

	fetch(id, options) {
		return this.get(`${Reflect.getMetadata(_potionURIMetadataKey, this._itemConstructor)}/${id}`, options);
	}

	query(options) {
		return this.get(Reflect.getMetadata(_potionURIMetadataKey, this._itemConstructor), options);
	}

	get(uri, {cache = true}: ItemFetchOptions = {}): Promise<any> {
		// Try to get from cache
		if (this.cache && this.cache.get) {
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
		promise = this._promises[uri] = Reflect.getMetadata(_potionMetadataKey, this._itemConstructor).fetch(uri, {cache, method: 'GET'}).then((json) => {
			delete this._promises[uri]; // Remove pending request
			return json;
		});

		return promise;
	}

	update(item: Item, data: any = {}, {cache = true}: ItemFetchOptions = {}): Promise<any> {
		return Reflect.getMetadata(_potionMetadataKey, this._itemConstructor).fetch(item.uri, {data, cache, method: 'PATCH'});
	}

	save(data: any = {}, {cache = true}: ItemFetchOptions = {}): Promise<any> {
		return Reflect.getMetadata(_potionMetadataKey, this._itemConstructor).fetch(Reflect.getMetadata(_potionURIMetadataKey, this._itemConstructor), {data, cache, method: 'POST'});
	}

	destroy(item: Item): Promise<any> {
		let {uri} = item;

		return Reflect.getMetadata(_potionMetadataKey, this._itemConstructor).fetch(uri, {method: 'DELETE'}).then(() => {
			// Clear the item from cache if exists
			if (this.cache && this.cache.get && this.cache.get(uri)) {
				this.cache.remove(uri);
			}
		});
	}
}


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

	fetch(uri, options?: PotionRequestOptions): Promise<any> {
		// Add the API prefix if not present
		let {prefix} = this;
		if (uri.indexOf(prefix) === -1) {
			uri = `${prefix}${uri}`;
		}

		return this.request(uri, options).then((response) => this._fromPotionJSON(response, options));
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

	private _fromPotionJSON(json: any, {cache}: ItemFetchOptions = {}): Promise<any> {
		let {promise} = (<typeof PotionBase>this.constructor);
		if (typeof json === 'object' && json !== null) {
			if (json instanceof Array) {
				return promise.all(json.map((item) => this._fromPotionJSON(item, {cache})));
			} else if (typeof json.$uri === 'string') {
				let {resource, uri} = this.parseURI(json.$uri);
				let promises = [];

				for (let key of Object.keys(json)) {
					if (key === '$uri') {
						promises.push(promise.resolve([key, uri]));
					} else {
						promises.push(this._fromPotionJSON(json[key], {cache}).then((value) => {
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
					if (cache && this.cache && this.cache.put) {
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
				promises.push(this._fromPotionJSON(json[key], {cache}).then((value) => {
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


export function route(uri: string, {method}: PotionRequestOptions = {}): (options?: ItemFetchOptions) => Promise<any> {
	return function (options?: ItemFetchOptions): any {
		let isCtor = typeof this === 'function';
		uri = `${isCtor ? Reflect.getMetadata(_potionURIMetadataKey, this) : this.uri}${uri}`;
		return Reflect.getMetadata(_potionMetadataKey, isCtor ? this : this.constructor).fetch(uri, Object.assign({method}, options));
	};
}

/* tslint:disable: variable-name */
export let Route = {
	GET(uri: string) {
		return route(uri, {method: 'GET'});
	},
	DELETE(uri: string) {
		return route(uri, {method: 'DELETE'});
	},
	POST(uri: string) {
		return route(uri, {method: 'POST'});
	},
	PATCH(uri: string) {
		return route(uri, {method: 'PATCH'});
	},
	PUT(uri: string) {
		return route(uri, {method: 'PUT'});
	}
};
