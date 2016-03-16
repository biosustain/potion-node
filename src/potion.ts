import 'reflect-metadata';
import {Observable} from 'rxjs/Observable';
import 'rxjs/add/observable/of';


interface ItemConstructor {
	store?: Store<Item>;
	new (object: any): Item;
}

export class Item {
	uri: string;

	get id() {
		const potion = <PotionBase>Reflect.getMetadata('potion', this.constructor);
		return parseInt(potion.parseURI(this.uri).params[0]);
	}

	static store: Store<Item>;

	static fetch(id): Observable<Item> {
		return this.store.fetch(id);
	}

	constructor(object: any = {}) {
		Object.assign(this, object);
	}
}


interface ParsedURI {
	resource: Item,
	params: string[]
}

export abstract class PotionBase {
	resources = {};
	prefix = '';

	constructor(options?) {
		Object.assign(this, options);
	}

	parseURI(uri: string): ParsedURI {
		uri = decodeURIComponent(uri);

		for (let [resourceURI] of Object.entries(this.resources)) {
			if (uri.indexOf(`${resourceURI}/`) === 0) {
				return {resource: this.resources[resourceURI], params: uri.substring(resourceURI.length + 1).split('/')};
			}
		}

		throw new Error(`Uninterpretable or unknown resource URI: ${uri}`);
	}

	register(uri: string, resource: ItemConstructor) {
		Reflect.defineMetadata('potion', this, resource);
		Reflect.defineMetadata('potion:uri', uri, resource);
		this.resources[uri] = resource;
		resource.store = new Store(resource);
	}

	abstract fetch(uri, options?: RequestInit): Observable<any>;

	request(uri, options?: RequestInit) {
		uri = `${this.prefix}${uri}`;
		return this.fetch(uri, options);
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

		console.log('URI: ', uri);

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
