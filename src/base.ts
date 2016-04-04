import 'core-js/shim';
import 'reflect-metadata';
import {
	fromCamelCase,
	toCamelCase,
	pairsToObject
} from './utils';


/**
 * @readonly decorator
 */

const _readonlyMetadataKey = Symbol('potion:readonly');
export function readonly(target, property) {
	const metadata = Reflect.getMetadata(_readonlyMetadataKey, target.constructor);
	Reflect.defineMetadata(_readonlyMetadataKey, Object.assign(metadata || {}, {[property]: true}), target.constructor);
}


function potionForCtor(ctor) {
	return {potion: Reflect.getMetadata(_potionMetadataKey, ctor), rootUri: Reflect.getMetadata(_potionUriMetadataKey, ctor)}
}


export interface ItemConstructor {
	new (object: any): Item;
}

export interface ItemOptions {
	'readonly'?: string[];
}

export class Item {
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
		return parseInt(params[0], 10);
	}

	protected _potion: PotionBase;
	protected _rootUri: string;
	protected _uri: string;

	static fetch(id, options?: PotionRequestOptions): Promise<Item> {
		const {potion, rootUri} = potionForCtor(this);
		return potion.get(`${rootUri}/${id}`, options);
	}

	static query(options?: PotionRequestOptions): Promise<Item[]> {
		const {potion, rootUri} = potionForCtor(this);
		return potion.get(rootUri, options);
	}

	static create(...args) {
		return Reflect.construct(this, args);
	}

	constructor(properties: any = {}, options?: ItemOptions) {
		Object.assign(this, properties);
		const {potion, rootUri} = potionForCtor(this.constructor);
		this._potion = potion;
		this._rootUri = rootUri;

		if (options && Array.isArray(options.readonly)) {
			options.readonly.forEach((property) => readonly(this, property));
		}
	}

	toJSON() {
		const properties = {};

		Object.keys(this)
			.filter((key) => {
				const metadata = Reflect.getMetadata(_readonlyMetadataKey, this.constructor);
				return key !== '_uri' && key !== '_potion' && key !== '_rootUri' && (!metadata || (metadata && !metadata[key]));
			})
			.forEach((key) => {
				properties[fromCamelCase(key)] = this[key];
			});

		return properties;
	}

	save(): Promise<Item> {
		return this._potion.save(this._rootUri, this.toJSON());
	}

	update(properties: any = {}): Promise<Item> {
		return this._potion.update(this, properties);
	}

	destroy(): Promise<Item> {
		return this._potion.destroy(this);
	}
}


export interface PotionCache<T extends Item> {
	get(id: string): T;
	set(id: string, item: T): T;
	clear(id: string): void;
}

export interface PotionOptions {
	prefix?: string;
	cache?: PotionCache<Item>;
}

export interface PotionRequestOptions {
	method?: 'GET' | 'PUT' | 'DELETE' | 'POST';
	cache?: any;
	data?: any;
}

const _potionMetadataKey = Symbol('potion');
const _potionUriMetadataKey = Symbol('potion:uri');

export abstract class PotionBase {
	resources = {};
	cache: PotionCache<Item>;
	Promise = Promise;

	private _prefix: string;
	private _promises = [];

	static create() {
		return Reflect.construct(this, arguments);
	}

	constructor({prefix = '', cache}: PotionOptions = {}) {
		this._prefix = prefix;
		this.cache = cache;
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

	private _fromPotionJSON(json: any): Promise<any> {
		if (typeof json === 'object' && json !== null) {
			if (json instanceof Array) {
				return this.Promise.all(json.map((item) => this._fromPotionJSON(item)));
			} else if (typeof json.$uri === 'string') {
				const {resource, uri} = this.parseURI(json.$uri);
				const promises = [];

				for (const key of Object.keys(json)) {
					if (key === '$uri') {
						promises.push(this.Promise.resolve([key, uri]));
						// } else if (constructor.deferredProperties && constructor.deferredProperties.includes(key)) {
						// 	converted[toCamelCase(key)] = () => this.fromJSON(value[key]);
					} else {
						promises.push(this._fromPotionJSON(json[key]).then((value) => {
							return [toCamelCase(key), value];
						}));
					}
				}

				return this.Promise.all(promises).then((propertyValuePairs) => {
					const properties: any = pairsToObject(propertyValuePairs); // `propertyValuePairs` is a collection of [key, value] pairs
					const obj = {};

					Object
						.keys(properties)
						.filter((key) => key !== '$uri')
						.forEach((key) => obj[key] = properties[key]);

					Object.assign(obj, {uri: properties.$uri});

					// TODO: might make sense to move this logic somewhere else
					let instance = Reflect.construct(<any>resource, [obj]);
					if (this.cache && this.cache.set) {
						this.cache.set(uri, <any>instance);
					}

					return instance;
				});
			} else if (Object.keys(json).length === 1) {
				if (typeof json.$ref === 'string') {
					let {uri} = this.parseURI(json.$ref);
					return this.get(uri);
				} else if (typeof json.$date !== 'undefined') {
					return this.Promise.resolve(new Date(json.$date));
				}
			}

			const promises = [];

			for (const key of Object.keys(json)) {
				promises.push(this._fromPotionJSON(json[key]).then((value) => {
					return [toCamelCase(key), value];
				}));
			}

			return this.Promise.all(promises).then((propertyValuePairs) => {
				return pairsToObject(propertyValuePairs);
			});
		} else {
			return this.Promise.resolve(json);
		}
	}

	request(uri, options?: PotionRequestOptions): Promise<any> {
		// Add the API prefix if not present
		if (uri.indexOf(this._prefix) === -1) {
			uri = `${this._prefix}${uri}`;
		}

		return this.fetch(uri, options);
	}

	get(uri, options?: PotionRequestOptions): Promise<any> {
		// Try to get from cache
		if (this.cache && this.cache.get) {
			const instance = this.cache.get(uri);
			if (instance) {
				return Promise.resolve(instance);
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
		promise = this._promises[uri] = this.request(uri, Object.assign({}, options, {method: 'GET'})).then((json) => {
			delete this._promises[uri]; // Remove pending request
			return this._fromPotionJSON(json);
		});

		return promise;
	}

	update(item: Item, data: any = {}): Promise<any> {
		return this.request(item.uri, {data, method: 'PUT'}).then((json) => this._fromPotionJSON(json));
	}

	save(rootUri: string, data: any = {}): Promise<any> {
		return this.request(rootUri, {data, method: 'POST'}).then((json) => this._fromPotionJSON(json));
	}

	destroy(item: Item): Promise<any> {
		const {uri} = item;

		return this.request(uri, {method: 'DELETE'}).then(() => {
			// Clear the item from cache if exists
			if (this.cache && this.cache.get && this.cache.get(uri)) {
				this.cache.clear(uri);
			}
		});
	}

	register(uri: string, resource: ItemConstructor) {
		Reflect.defineMetadata(_potionMetadataKey, this, resource);
		Reflect.defineMetadata(_potionUriMetadataKey, uri, resource);
		this.resources[uri] = resource;
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
		const isCtor = typeof this === 'function';
		const {potion, rootUri} = potionForCtor(isCtor ? this : this.constructor);

		return potion.get(
			`${isCtor ? rootUri : this.uri}${uri}`,
			Object.assign({method}, options)
		);
	};
}

export class Route {
	static GET(uri: string) {
		return route(uri, {method: 'GET'});
	}

	static DELETE(uri: string) {
		return route(uri, {method: 'DELETE'});
	}

	static POST(uri: string) {
		return route(uri, {method: 'POST'});
	}

	static PUT(uri: string) {
		return route(uri, {method: 'PUT'});
	}
}
