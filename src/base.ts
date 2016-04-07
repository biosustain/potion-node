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


/**
 * @readonly decorator
 */

let _readonlyMetadataKey = Symbol('potion:readonly');
export function readonly(target, property) {
	let metadata = Reflect.getMetadata(_readonlyMetadataKey, target.constructor);
	Reflect.defineMetadata(_readonlyMetadataKey, Object.assign(metadata || {}, {[property]: true}), target.constructor);
}


export interface ItemConstructor {
	new (object: any): Item;

	potion: PotionBase;
	rootURI: string;

	store?: Store<Item>;
}

export interface ItemOptions {
	'readonly'?: string[];
}

// TODO: when https://github.com/Microsoft/TypeScript/issues/3964 is implemented,
// use `let uri = Symbol('Resource uri');` and `class Item {[uri]: string}`
export class Item {
	static potion: PotionBase;
	static rootURI: string;

	static store: Store<any>;

	get uri() {
		return this._uri;
	}

	set uri(uri) {
		this._uri = uri;
	}

	get id() {
		if (!this.uri) {
			return null;
		}

		let {params} = (<typeof Item>this.constructor).potion.parseURI(this.uri);
		return parseInt(params[0], 10);
	}

	protected _uri: string;

	static fetch(id, options?: PotionRequestOptions): Promise<Item> {
		return this.store.query(id, options);
	}

	static query(options?: PotionRequestOptions): Promise<Item[]> {
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

	save(): Promise<Item> {
		return (<typeof Item>this.constructor).store.save(this.toJSON());
	}

	update(properties: any = {}): Promise<Item> {
		return (<typeof Item>this.constructor).store.update(this, properties);
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
				return key !== '_uri' && (!metadata || (metadata && !metadata[key]));
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

	protected _potion: PotionBase;
	protected _rootURI: string;

	private _promises = [];

	constructor(constructor: ItemConstructor) {
		let {potion, rootURI} = constructor;

		this.cache = potion.itemCache;
		this.promise = (<typeof PotionBase>potion.constructor).promise;

		this._potion = potion;
		this._rootURI = rootURI;
	}

	query(...args) {
		let [id, options] = args;
		let uri = this._rootURI;

		if (typeof id === 'number') {
			uri = `${uri}/${id}`
		} else {
			options = id;
		}

		return this.fetch(uri, options);
	}

	fetch(uri, options?: PotionRequestOptions): Promise<any> {
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
		promise = this._promises[uri] = this._potion.request(uri, Object.assign({}, options, {method: 'GET'})).then((json) => {
			delete this._promises[uri]; // Remove pending request
			return this._fromPotionJSON(json);
		});

		return promise;
	}

	update(item: Item, data: any = {}): Promise<any> {
		return this._potion.request(item.uri, {data, method: 'PATCH'}).then((json) => this._fromPotionJSON(json));
	}

	save(data: any = {}): Promise<any> {
		return this._potion.request(this._rootURI, {data, method: 'POST'}).then((json) => this._fromPotionJSON(json));
	}

	destroy(item: Item): Promise<any> {
		let {uri} = item;

		return this._potion.request(uri, {method: 'DELETE'}).then(() => {
			// Clear the item from cache if exists
			if (this.cache && this.cache.get && this.cache.get(uri)) {
				this.cache.remove(uri);
			}
		});
	}

	private _fromPotionJSON(json: any): Promise<any> {
		if (typeof json === 'object' && json !== null) {
			if (json instanceof Array) {
				return this.promise.all(json.map((item) => this._fromPotionJSON(item)));
			} else if (typeof json.$uri === 'string') {
				let {resource, uri} = this._potion.parseURI(json.$uri);
				let promises = [];

				for (let key of Object.keys(json)) {
					if (key === '$uri') {
						promises.push(this.promise.resolve([key, uri]));
						// } else if (constructor.deferredProperties && constructor.deferredProperties.includes(key)) {
						// 	converted[toCamelCase(key)] = () => this.fromJSON(value[key]);
					} else {
						promises.push(this._fromPotionJSON(json[key]).then((value) => {
							return [toCamelCase(key), value];
						}));
					}
				}

				return this.promise.all(promises).then((propertyValuePairs) => {
					let properties: any = pairsToObject(propertyValuePairs); // `propertyValuePairs` is a collection of [key, value] pairs
					let obj = {};

					Object
						.keys(properties)
						.filter((key) => key !== '$uri')
						.forEach((key) => obj[key] = properties[key]);

					Object.assign(obj, {uri: properties.$uri});

					let item = Reflect.construct(<any>resource, [obj]);
					if (this.cache && this.cache.put) {
						this.cache.put(uri, <any>item);
					}

					return item;
				});
			} else if (Object.keys(json).length === 1) {
				if (typeof json.$ref === 'string') {
					let {uri} = this._potion.parseURI(json.$ref);
					return this.fetch(uri);
				} else if (typeof json.$date !== 'undefined') {
					return this.promise.resolve(new Date(json.$date));
				}
			}

			let promises = [];

			for (let key of Object.keys(json)) {
				promises.push(this._fromPotionJSON(json[key]).then((value) => {
					return [toCamelCase(key), value];
				}));
			}

			return this.promise.all(promises).then((propertyValuePairs) => {
				return pairsToObject(propertyValuePairs);
			});
		} else {
			return this.promise.resolve(json);
		}
	}
}


export interface PotionItemCache<T extends Item> {
	get(key: string): T;
	put(key: string, item: T): T;
	remove(key: string): void;
}

export interface PotionOptions {
	prefix?: string;
	itemCache?: PotionItemCache<Item>;
}

export interface PotionRequestOptions {
	method?: 'GET' | 'PUT' | 'PATCH' | 'DELETE' | 'POST';
	cache?: any;
	data?: any;
}

export abstract class PotionBase {
	static promise = (<any>window).Promise;
	resources = {};
	itemCache: PotionItemCache<Item>;

	private _prefix: string;

	constructor({prefix = '', itemCache}: PotionOptions = {}) {
		this._prefix = prefix;
		this.itemCache = itemCache;
	}

	parseURI(uri: string) {
		uri = decodeURIComponent(uri);

		if (uri.indexOf(this._prefix) === 0) {
			uri = uri.substring(this._prefix.length);
		}

		for (let [resourceURI] of (<any>Object).entries(this.resources)) {
			if (uri.indexOf(`${resourceURI}/`) === 0) {
				return {uri, resource: this.resources[resourceURI], params: uri.substring(resourceURI.length + 1).split('/')};
			}
		}

		throw new Error(`Uninterpretable or unknown resource URI: ${uri}`);
	}

	abstract fetch(uri, options?: PotionRequestOptions): Promise<any>;

	request(uri, options?: PotionRequestOptions): Promise<any> {
		// Add the API prefix if not present
		if (uri.indexOf(this._prefix) === -1) {
			uri = `${this._prefix}${uri}`;
		}

		return this.fetch(uri, options);
	}

	register(uri: string, resource: any) {
		this.resources[uri] = resource;

		// `potion` and `rootURI` props must be set before `store`
		resource.potion = this;
		resource.rootURI = uri;

		resource.store = new Store(resource);
	}

	registerAs(uri: string): ClassDecorator {
		return (target: any) => {
			this.register(uri, target);
			return target;
		};
	}
}


export function route(uri: string, {method}: PotionRequestOptions = {}): (options?) => Promise<any> {
	return function (options?: PotionRequestOptions) {
		let isCtor = typeof this === 'function';
		let {store, rootURI} = isCtor ? this : this.constructor;

		return store.fetch(
			`${isCtor ? rootURI : this.uri}${uri}`,
			Object.assign({method}, options)
		);
	};
}

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
