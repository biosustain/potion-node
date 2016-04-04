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


const _potionMetadataKey = Symbol('potion');
const _potionUriMetadataKey = Symbol('potion:uri');

function potionForCtor(ctor) {
	return {potion: Reflect.getMetadata(_potionMetadataKey, ctor), rootUri: Reflect.getMetadata(_potionUriMetadataKey, ctor)};
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

		const {params} = this._potion.parseUri(this.uri);
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


export interface PotionItemCache<T extends Item> {
	get(id: string): T;
	put(id: string, item: T): T;
	clear(id: string): void;
}

export interface PotionOptions {
	prefix?: string;
	itemCache?: PotionItemCache<Item>;
}

export interface PotionRequestOptions {
	method?: 'GET' | 'PUT' | 'DELETE' | 'POST';
	cache?: any;
	data?: any;
}

export abstract class PotionBase {
	resources = {};
	promise = (<any>window).Promise;

	private _prefix: string;
	private _itemCache: PotionItemCache<Item>;
	private _promises = [];

	static create(...args) {
		return Reflect.construct(this, args);
	}

	constructor({prefix = '', itemCache}: PotionOptions = {}) {
		this._prefix = prefix;
		this._itemCache = itemCache;
	}

	parseUri(uri: string) {
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

	get(uri, options?: PotionRequestOptions): Promise<any> {
		// Try to get from cache
		if (this._itemCache && this._itemCache.get) {
			const item = this._itemCache.get(uri);
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
		promise = this._promises[uri] = this.request(uri, Object.assign({}, options, {method: 'GET'})).then((json) => {
			delete this._promises[uri]; // Remove pending request
			return this._fromPotionJson(json);
		});

		return promise;
	}

	update(item: Item, data: any = {}): Promise<any> {
		return this.request(item.uri, {data, method: 'PUT'}).then((json) => this._fromPotionJson(json));
	}

	save(rootUri: string, data: any = {}): Promise<any> {
		return this.request(rootUri, {data, method: 'POST'}).then((json) => this._fromPotionJson(json));
	}

	destroy(item: Item): Promise<any> {
		const {uri} = item;

		return this.request(uri, {method: 'DELETE'}).then(() => {
			// Clear the item from cache if exists
			if (this._itemCache && this._itemCache.get && this._itemCache.get(uri)) {
				this._itemCache.clear(uri);
			}
		});
	}

	register(uri: string, resource: Item) {
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

	private _fromPotionJson(json: any): Promise<any> {
		if (typeof json === 'object' && json !== null) {
			if (json instanceof Array) {
				return this.promise.all(json.map((item) => this._fromPotionJson(item)));
			} else if (typeof json.$uri === 'string') {
				const {resource, uri} = this.parseUri(json.$uri);
				const promises = [];

				for (const key of Object.keys(json)) {
					if (key === '$uri') {
						promises.push(this.promise.resolve([key, uri]));
						// } else if (constructor.deferredProperties && constructor.deferredProperties.includes(key)) {
						// 	converted[toCamelCase(key)] = () => this.fromJSON(value[key]);
					} else {
						promises.push(this._fromPotionJson(json[key]).then((value) => {
							return [toCamelCase(key), value];
						}));
					}
				}

				return this.promise.all(promises).then((propertyValuePairs) => {
					const properties: any = pairsToObject(propertyValuePairs); // `propertyValuePairs` is a collection of [key, value] pairs
					const obj = {};

					Object
						.keys(properties)
						.filter((key) => key !== '$uri')
						.forEach((key) => obj[key] = properties[key]);

					Object.assign(obj, {uri: properties.$uri});

					let item = Reflect.construct(<any>resource, [obj]);
					if (this._itemCache && this._itemCache.put) {
						this._itemCache.put(uri, <any>item);
					}

					return item;
				});
			} else if (Object.keys(json).length === 1) {
				if (typeof json.$ref === 'string') {
					let {uri} = this.parseUri(json.$ref);
					return this.get(uri);
				} else if (typeof json.$date !== 'undefined') {
					return this.promise.resolve(new Date(json.$date));
				}
			}

			const promises = [];

			for (const key of Object.keys(json)) {
				promises.push(this._fromPotionJson(json[key]).then((value) => {
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
