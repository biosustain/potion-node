import 'core-js/shim';
import 'reflect-metadata';
import {Observable} from 'rxjs/Observable';
import 'rxjs/add/observable/concat';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/operator/mergeMap';
import {toCamelCase, pairsToObject} from './utils';


export interface Cache<T extends Item> {
	get(id: string): T;
	set(id: string, item: T): T;
}


interface ItemConstructor {
	store?: Store<Item>;
	new (object: any): Item;
}

export class Item {
	protected _uri: string;

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

		const potion = <PotionBase>Reflect.getMetadata('potion', this.constructor);
		const {params} = potion.parseURI(this.uri);
		return parseInt(params[0]);
	}

	static store: Store<any>;

	static fetch(id, options?: any): Observable<Item> {
		return this.store.fetch(id, options);
	}

	static query(options?: any): Observable<Item[]> {
		return this.store.query(options);
	}

	static create(properties: any = {}) {
		return new this(properties);
	}

	constructor(properties: any = {}) {
		Object.assign(this, properties);
	}

	toJSON() {
		const properties = {};

		Object.keys(this)
			.filter((key) => key !== '_uri')
			.forEach((key) => {
				properties[key] = this[key];
			});

		return properties;
	}

}


interface ParsedURI {
	resource: Item;
	params: string[];
	uri: string;
}

interface PotionOptions {
	prefix?: string;
	cache?: Cache;
}

export abstract class PotionBase {
	resources = {};
	private _prefix: string;
	private _cache: Cache;
	private _observables = [];

	static create() {
		return Reflect.construct(this, arguments);
	}

	constructor({prefix = '', cache = {}}: PotionOptions = {}) {
		this._prefix = prefix;
		this._cache = cache;
	}

	parseURI(uri: string): ParsedURI {
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
					const properties = pairsToObject(propertyValuePairs); // `propertyValuePairs` is a collection of [key, value] pairs
					const obj = {};

					Object
						.keys(properties)
						.filter((key) => key !== '$uri')
						.forEach((key) => obj[key] = properties[key]);

					Object.assign(obj, {uri: properties.$uri});

					let instance = new resource(obj);
					if (this._cache.get && !this._cache.get(uri) && this._cache.set) {
						this._cache.set(uri, <any>instance);
					}

					return instance;
				});
			} else if (Object.keys(json).length === 1) {
				if (typeof json.$ref === 'string') {
					let {uri} = this.parseURI(json.$ref);
					return new Promise((resolve) => {
						this.request(uri).subscribe((item) => {
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

	// TODO: fetch should return promise
	abstract fetch(uri, options?: any): Observable<any>;

	// TODO: request should return promise
	// TODO: we must only cache GET requests
	request(uri, options?: any): Observable<any> {
		let instance;

		// Try to get from cache
		if (this._cache.get && (instance = this._cache.get(uri))) {
			return Observable.create((observer) => observer.next(instance));
		}

		// If we already asked for the resource,
		// return the exiting observable.
		let obs = this._observables[uri];
		if (obs) {
			return obs;
		}

		// Register a pending request,
		// get the data,
		// and parse it.
		obs = this._observables[uri] = this.fetch(`${this._prefix}${uri}`, options).mergeMap((json) => {
			delete this._observables[uri]; // Remove pending request
			return Observable.fromPromise(this._fromPotionJSON(json));
		});

		return obs;
	}

	register(uri: string, resource: ItemConstructor) {
		Reflect.defineMetadata('potion', this, resource);
		Reflect.defineMetadata('potion:uri', uri, resource);
		this.resources[uri] = resource;
		resource.store = new Store(resource);
	}

	registerAs(uri: string): ClassDecorator {
		return (target: ItemConstructor) => {
			this.register(uri, target);
			return target;
		}
	}
}


class Store<T extends Item> {
	private _itemConstructor: ItemConstructor;
	private _potion: PotionBase;
	private _rootURI: string;

	constructor(itemConstructor: ItemConstructor) {
		this._itemConstructor = itemConstructor;
		this._potion = Reflect.getMetadata('potion', itemConstructor);
		this._rootURI = Reflect.getMetadata('potion:uri', itemConstructor);
	}

	fetch(id: number, options?: any): Observable<T> {
		const uri = `${this._rootURI}/${id}`;

		return new Observable<T>((observer) => {
			this._potion
				.request(uri, Object.assign({method: 'GET'}, options))
				.subscribe((resource) => observer.next(new this._itemConstructor(Object.assign({}, {uri}, resource))), (error) => observer.error(error));

		});
	}

	query(options?: any): Observable<T> {
		return new Observable<T>((observer) => {
			this._potion
				.request(this._rootURI, Object.assign({method: 'GET'}, options))
				.subscribe((resources) => observer.next(resources.map((resource) => new this._itemConstructor(resource))), (error) => observer.error(error));

		});
	}
}


export function route(uri: string, {method = 'GET'} = {}): (any?) => Observable<any> {
	return function (options?: any) {
		let potion: PotionBase;

		if (typeof this === 'function') {
			potion = <PotionBase>Reflect.getMetadata('potion', this);
			uri = `${Reflect.getMetadata('potion:uri', this)}${uri}`;
		} else {
			potion = <PotionBase>Reflect.getMetadata('potion', this.constructor);
			uri = `${this.uri}${uri}`;
		}

		return potion.request(uri, Object.assign({method}, options));
	}
}

export class Route {
	static GET(uri: string): (any?) => Observable<any> {
		return route(uri, {method: 'GET'});
	}

	static DELETE(uri: string): (any?) => Observable<any> {
		return route(uri, {method: 'DELETE'});
	}

	static PATCH(uri: string): (any?) => Observable<any> {
		return route(uri, {method: 'PATCH'});
	}

	static POST(uri: string): (any?) => Observable<any> {
		return route(uri, {method: 'POST'});
	}

	static PUT(uri: string): (any?) => Observable<any> {
		return route(uri, {method: 'PUT'});
	}
}
