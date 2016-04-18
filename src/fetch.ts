import {
	PotionRequestOptions,
	PotionOptions,
	PotionBase
} from './base';

import {MemCache} from './utils';

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

	request(uri, {method = 'GET', data = null, cache = true}: PotionRequestOptions = {}): Promise<any> {
		// Use window.fetch for making requests,
		// see https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch for API.
		// Polyfill at https://github.com/github/fetch.
		// let {method, data, cache} = Object.assign({method: 'GET', cache: true}, options);
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
			let headers: Headers = new Headers();
			headers.set('Accept', 'application/json');
			headers.set('Content-Type', 'application/json');

			Object.assign(init, {
				headers,
				body: JSON.stringify(data)
			});
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
