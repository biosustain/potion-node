import 'core-js/shim';
import 'reflect-metadata';
import {
	fromCamelCase,
	pairsToObject,
	toCamelCase
} from './utils';


export interface Cache<T extends Item> {
	get(id: string): T;
	set(id: string, item: T): T;
	clear(id: string): void;
}


interface ItemConstructor {
	store?: Store<Item>;
	new (object: any): Item;
}

interface ItemOptions {
	'readonly': string[];
}

const readonlyMetadataKey = Symbol('readonly');

export function readonly(target, property) {
	const metadata = Reflect.getMetadata(readonlyMetadataKey, target.constructor);
	Reflect.defineMetadata(readonlyMetadataKey, Object.assign(metadata || {}, {[property]: true}), target.constructor);
}

export class Item {
	protected _uri: string;
	protected _potion: PotionBase;
	protected _rootUri: string;

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

		const {params} = this._potion.parseURI(this.uri);
		return parseInt(params[0]);
	}

	static store: Store<any>;

	static fetch(id, options?: PotionFetchOptions): Promise<Item> {
		return this.store.fetch(id, options);
	}

	static query(options?: PotionFetchOptions): Promise<Item[]> {
		return this.store.query(options);
	}

	static create(...args) {
		return Reflect.construct(this, args);
	}

	constructor(properties: any = {}, options?: ItemOptions) {
		Object.assign(this, properties);
		this._potion = <PotionBase>Reflect.getMetadata('potion', this.constructor);
		this._rootUri = Reflect.getMetadata('potion:uri', this.constructor);

		if (options && options.readonly) {
			options.readonly.forEach((property) => readonly(this, property))
		}
	}

	update(properties?: any = {}): Promise<Item> {
		return this._potion.update(this, properties);
	}

	save(): Promise<Item> {
		return this._potion.save(this._rootUri, this.toJSON());
	}

	['delete'](): Promise<Item> {
		return this._potion['delete'](this);
	}

	toJSON() {
		const properties = {};

		Object.keys(this)
			.filter((key) => {
				const metadata = Reflect.getMetadata(readonlyMetadataKey, this.constructor);
				return key !== '_uri' && key !== '_potion' && key !== '_rootUri' && (!metadata || (metadata && !metadata[key]))
			})
			.forEach((key) => {
				properties[fromCamelCase(key)] = this[key];
			});

		return properties;
	}
}


interface PotionEndpoint {
	resource: Item;
	params: string[];
	uri: string;
}

export interface PotionOptions {
	prefix?: string;
	cache?: Cache;
}

export interface PotionFetchOptions {
	method?: 'GET' | 'PUT' | 'DELETE' | 'POST';
	data?: any;
}

export abstract class PotionBase {
	resources = {};
	private _prefix: string;
	private _cache: Cache;
	private _promises = [];

	static create() {
		return Reflect.construct(this, arguments);
	}

	constructor({prefix = '', cache = {}}: PotionOptions = {}) {
		this._prefix = prefix;
		this._cache = cache;
	}

	parseURI(uri: string): PotionEndpoint {
		uri = decodeURIComponent(uri);

		if (uri.indexOf(this._prefix) === 0) {
			uri = uri.substring(this._prefix.length);
		}

		for (let [resourceURI] of Object.entries(this.resources)) {
			if (uri.indexOf(`${resourceURI}/`) === 0) {
				return {uri, resource: this.resources[resourceURI], params: uri.substring(resourceURI.length + 1).split('/')};
			}
		}

		throw new Error(`Uninterpretable or unknown resource URI: ${uri}`);
	}

	private _fromPotionJSON(json: any): Promise<any> {
		if (typeof json === 'object' && json !== null) {
			if (json instanceof Array) {
				return Promise.all(json.map((item) => this._fromPotionJSON(item)));
			} else if (typeof json.$uri == 'string') {
				const {resource, uri} = this.parseURI(json.$uri);
				const promises = [];

				for (const key of Object.keys(json)) {
					if (key == '$uri') {
						promises.push(Promise.resolve([key, uri]));
						// } else if (constructor.deferredProperties && constructor.deferredProperties.includes(key)) {
						// 	converted[toCamelCase(key)] = () => this.fromJSON(value[key]);
					} else {
						promises.push(this._fromPotionJSON(json[key]).then((value) => {
							return [toCamelCase(key), value]
						}));
					}
				}

				return Promise.all(promises).then((propertyValuePairs) => {
					const properties: any = pairsToObject(propertyValuePairs); // `propertyValuePairs` is a collection of [key, value] pairs
					const obj = {};

					Object
						.keys(properties)
						.filter((key) => key !== '$uri')
						.forEach((key) => obj[key] = properties[key]);

					Object.assign(obj, {uri: properties.$uri});

					let instance = new resource(obj);
					if (this._cache.set) {
						this._cache.set(uri, <any>instance);
					}

					return instance;
				});
			} else if (Object.keys(json).length === 1) {
				if (typeof json.$ref === 'string') {
					let {uri} = this.parseURI(json.$ref);
					return new Promise((resolve) => {
						this.get(uri).then((item) => {
							resolve(item);
						});
					});
				} else if (typeof json.$date !== 'undefined') {
					return Promise.resolve(new Date(json.$date));
				}
			}

			const promises = [];

			for (const key of Object.keys(json)) {
				promises.push(this._fromPotionJSON(json[key]).then((value) => {
					return [toCamelCase(key), value]
				}));
			}

			return Promise.all(promises).then((propertyValuePairs) => {
				return pairsToObject(propertyValuePairs);
			});
		} else {
			return Promise.resolve(json);
		}
	}

	abstract fetch(uri, options?: PotionFetchOptions): Promise<any>;

	request(uri, options?: PotionFetchOptions): Promise<any> {
		// Add the API prefix if not present
		if (uri.indexOf(this._prefix) === -1) {
			uri = `${this._prefix}${uri}`;
		}

		return this.fetch(uri, options);
	}

	get(uri, options?: PotionFetchOptions): Promise<any> {
		let instance;

		// Try to get from cache
		if (this._cache.get && (instance = this._cache.get(uri))) {
			return Promise.resolve(instance);
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
		promise = this._promises[uri] = new Promise((resolve, reject) => {
			this.request(uri, Object.assign({}, options, {method: 'GET'})).then(
				(json) => {
					delete this._promises[uri]; // Remove pending request
					resolve(this._fromPotionJSON(json));
				},
				reject
			)
		});

		return promise;
	}

	update(item: Item, data?: any = {}): Promise<any> {
		return this.request(item.uri, {data, method: 'PUT'}).then((json) => this._fromPotionJSON(json));
	}

	save(rootUri: string, data: any = {}): Promise<any> {
		return this.request(rootUri, {data, method: 'POST'}).then((json) => this._fromPotionJSON(json));
	}

	['delete'](item: Item): Promise<any> {
		const {uri} = item;

		return new Promise<>((resolve, reject) => {
			this.request(uri, {method: 'DELETE'}).then(() => {
				// Clear the item from cache if exists
				if (this._cache.get && this._cache.get(uri)) {
					this._cache.clear(uri);
				}

				resolve();
			}, reject)
		});
	}

	register(uri: string, resource: ItemConstructor) {
		Reflect.defineMetadata('potion', this, resource);
		Reflect.defineMetadata('potion:uri', uri, resource);
		this.resources[uri] = resource;
		resource.store = new Store(resource);
	}

	registerAs(uri: string): ClassDecorator {
		return <ItemConstructor>(target: ItemConstructor) => {
			this.register(uri, target);
			return target;
		}
	}
}


class Store<T extends Item> {
	private _potion: PotionBase;
	private _rootURI: string;

	constructor(ctor: ItemConstructor) {
		this._potion = Reflect.getMetadata('potion', ctor);
		this._rootURI = Reflect.getMetadata('potion:uri', ctor);
	}

	fetch(id: number, options?: PotionFetchOptions): Promise<T> {
		return this._potion.get(`${this._rootURI}/${id}`, options);
	}

	query(options?: PotionFetchOptions): Promise<T> {
		return this._potion.get(this._rootURI, options);
	}
}


export function route(uri: string, {method = 'GET'}: PotionFetchOptions = {}): (any?) => Promise<any> {
	return function (options?: PotionFetchOptions) {
		let potion: PotionBase;

		if (typeof this === 'function') {
			potion = <PotionBase>Reflect.getMetadata('potion', this);
			uri = `${Reflect.getMetadata('potion:uri', this)}${uri}`;
		} else {
			potion = <PotionBase>Reflect.getMetadata('potion', this.constructor);
			uri = `${this.uri}${uri}`;
		}

		return potion.get(uri, Object.assign({method}, options));
	}
}

export class Route {
	static GET(uri: string): (any?) => Promise<any> {
		return route(uri, {method: 'GET'});
	}

	static DELETE(uri: string): (any?) => Promise<any> {
		return route(uri, {method: 'DELETE'});
	}

	static POST(uri: string): (any?) => Promise<any> {
		return route(uri, {method: 'POST'});
	}

	static PUT(uri: string): (any?) => Promise<any> {
		return route(uri, {method: 'PUT'});
	}
}
