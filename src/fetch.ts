import {
	PotionItemCache,
	PotionRequestOptions,
	PotionOptions,
	PotionBase
} from './base';

export {
	PotionItemCache,
	Item,
	Route,
	Pagination
} from './base';

export class Potion extends PotionBase {
	constructor(options?: PotionOptions) {
		super(Object.assign({cache: new MemCache()}, options));
	}

	request(uri, options?: PotionRequestOptions): Promise<any> {
		// Use window.fetch for making requests,
		// see https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch for API.
		// Polyfill at https://github.com/github/fetch.
		let {method, data, cache} = Object.assign({method: 'GET', cache: true}, options);
		let init: RequestInit = {
			method,
			cache: cache ? 'default' : 'no-cache'
		};

		// Make sure cookies are sent
		// https://github.com/github/fetch#sending-cookies
		init.credentials = 'include';

		if (data) {
			// POST/PUT/PATCH needs headers and JSON body,
			// see https://github.com/github/fetch#post-json for more info.
			init.body = JSON.stringify(options.data);
			init.headers = {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			};
		}

		return fetch(uri, init).then((response) => {
			if (response.ok) {
				return response.json().then(
					(json) => {
						let headers = {};

						response.headers.forEach((value, name) => {
							headers[name] = value;
						});

						return {headers, data: json};
					},
					(error) => (error)
				);
			} else {
				let error: any = new Error(response.statusText);
				error.response = response;
				throw error;
			}
		});
	}
}

class MemCache implements PotionItemCache<any> {
	protected _items: Map<string, any>;

	constructor() {
		this._items = new Map();
	}

	get(key: string) {
		return this._items.get(key);
	}

	put(key, item) {
		return this._items.set(key, item).get(key);
	}

	remove(key: string) {
		this._items.delete(key);
	}
}
