import {
	PotionRequestOptions,
	PotionBase
} from './base';

export {
	PotionItemCache,
	Item,
	Route
} from './base';

export class Potion extends PotionBase {
	fetch(uri, options?: PotionRequestOptions): Promise<any> {
		// Use isomorphic fetch for making requests,
		// see https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch for API.
		// https://github.com/github/fetch

		let {method, data, cache} = options || {method: 'GET', data: null, cache: 'default'};
		let init: RequestInit = {method, cache};

		// Make sure cookies are sent
		// https://github.com/github/fetch#sending-cookies
		init.credentials = 'include';

		if (data) {
			// POST/PUT needs headers and JSON body
			// https://github.com/github/fetch#post-json
			init.body = JSON.stringify(options.data);
			init.headers = {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			};
		}

		return fetch(uri, init).then((response) => {
			if (response.ok) {
				return response.json().then((json) => json, (error) => (error));
			} else {
				let error: any = new Error(response.statusText);
				error.response = response;
				throw error;
			}
		});
	}
}
