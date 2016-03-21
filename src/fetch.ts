import {
	PotionFetchOptions,
	PotionBase
} from "./potion";

export class Potion extends PotionBase {
	fetch(uri, options?: PotionFetchOptions): Promise<any> {
		// Use isomorphic fetch for making requests,
		// see https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch for API.
		// https://www.npmjs.com/package/isomorphic-fetch
		
		const {method, data} = options || {};
		const init: RequestInit = {method};

		if (data) {
			init.body = options.data
		}

		return fetch(uri, init).then((response) => response.json());
	}
}
