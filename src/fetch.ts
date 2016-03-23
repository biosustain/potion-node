import {
	PotionFetchOptions,
	PotionBase
} from './potion';

export class Potion extends PotionBase {
	fetch(uri, options?: PotionFetchOptions): Promise<any> {
		// Use isomorphic fetch for making requests,
		// see https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch for API.
		// https://www.npmjs.com/package/isomorphic-fetch

		const {method, data} = options || {method: 'GET', data: null};
		const init: RequestInit = {method};

		if (data) {
			init.body = options.data;
		}

		return new Promise((resolve, reject) => {
			fetch(uri, init)
				.then((response) => response.text())
				.then(
				(text: any) => {
					let json;

					try {
						json = JSON.parse(text);
					} catch (e) {
						json = null;
					}

					return resolve(json);
				},
				reject
			);
		});
	}
}
