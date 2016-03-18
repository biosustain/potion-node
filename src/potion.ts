import 'core-js/shim';
import 'reflect-metadata';
import {Observable} from 'rxjs/Observable';
import 'rxjs/add/observable/concat';
import 'rxjs/add/operator/mergeMap';


export interface Cache<T extends Item> {
	get(id: string): T;
	set(id: string, item: T): T;
}


interface ItemConstructor {
	store?: Store<Item>;
	new (object: any): Item;
}

export class Item {
	uri: string;

	get id() {
		if (!this.uri) {
			return null;
		}

		const potion = <PotionBase>Reflect.getMetadata('potion', this.constructor);
		const {params} = potion.parseURI(this.uri);
		return parseInt(params[0]);
	}

	static store: Store<Item>;

	static fetch(id): Observable<Item> {
		return this.store.fetch(id);
	}

	static create(attrs: any = {}) {
		return new this(attrs);
	}

	constructor(attrs: any = {}) {
		Object.assign(this, attrs);
	}

	toJSON() {
		const attrs = {};

		Object.keys(this)
			.filter((key) => key !== 'uri')
			.forEach((key) => {
				attrs[key] = this[key];
			});

		return attrs;
	}

}


function toCamelCase(string) {
	return string.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
}

interface ParsedURI {
	resource: Item,
	params: string[]
}

export abstract class PotionBase {
	resources = {};
	prefix: string;
	cache: Cache;
	private _observables = [];

	static create() {
		return Reflect.construct(this, arguments);
	}

	constructor({prefix = '', cache = {}} = {}) {
		Object.assign(this, {prefix, cache});
	}

	parseURI(uri: string): ParsedURI {
		uri = decodeURIComponent(uri);

		if (uri.indexOf(this.prefix) === 0) {
			uri = uri.substring(this.prefix.length);
		}

		for (let [resourceURI] of Object.entries(this.resources)) {
			if (uri.indexOf(`${resourceURI}/`) === 0) {
				return {
					uri,
					resource: this.resources[resourceURI],
					params: uri.substring(resourceURI.length + 1).split('/')
				};
			}
		}

		throw new Error(`Uninterpretable or unknown resource URI: ${uri}`);
	}

	private _fromPotionJSON(json: any): Observable<any> {
		// TODO: implement custom deserialization
		// TODO: implement recursive ref resolve

		return new Observable<any>((observer) => observer.next(json));
	}

	abstract fetch(uri, options?: RequestInit): Observable<any>;

	request(uri, options?: RequestInit) {
		let instance;

		// Try to get from cache
		if (this.cache.get && (instance = this.cache.get(uri))) {
			return instance;
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
		obs = this._observables[uri] = this.fetch(`${this.prefix}${uri}`, options).mergeMap((json) => {
			delete this._observables[uri]; // Remove pending request
			return this._fromPotionJSON(json);
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

	fetch(id: number): Observable<T> {
		const uri = `${this._rootURI}/${id}`;

		return new Observable<T>((observer) => {
			this._potion
				.request(uri, {method: 'GET'})
				.subscribe((resource) => observer.next(new this._itemConstructor(Object.assign({}, {uri}, resource))), (error) => observer.error(error));

		});
	}
}


function _route(uri: string, {method = 'GET'} = {}): (any?) => Observable<any> {
	return function (options: any = {}) {
		let potion: PotionBase;

		if (typeof this === 'function') {
			potion = <PotionBase>Reflect.getMetadata('potion', this);
			uri = `${Reflect.getMetadata('potion:uri', this)}${uri}`;
		} else {
			potion = <PotionBase>Reflect.getMetadata('potion', this.constructor);
			uri = `${this.uri}${uri}`;
		}

		return potion.request(uri, {method});
	}
}

export class Route {
	static GET(uri: string): (any?) => Observable<any> {
		return _route(uri, {method: 'GET'});
	}

	static DELETE(uri: string): (any?) => Observable<any> {
		return _route(uri, {method: 'DELETE'});
	}

	static PATCH(uri: string): (any?) => Observable<any> {
		return _route(uri, {method: 'PATCH'});
	}

	static POST(uri: string): (any?) => Observable<any> {
		return _route(uri, {method: 'POST'});
	}

	static PUT(uri: string): (any?) => Observable<any> {
		return _route(uri, {method: 'PUT'});
	}
}
