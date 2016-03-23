import {
	PotionFetchOptions,
	PotionBase
} from './potion';


export class Potion extends PotionBase {
	fetch(uri, options?: PotionFetchOptions): Promise<any> {
		// Use isomorphic fetch for making requests,
		// see https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch for API.
		// https://github.com/github/fetch

		const {method, data, cache} = options || {method: 'GET', data: null, cache: 'default'};
		const init: RequestInit = {method, cache};

		if (data) {
			init.body = options.data;
		}

		return new Promise((resolve, reject) => {
			fetch(uri, init)
				.then(checkStatus)
				.then(parseAsText)
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


function checkStatus(response) {
	if (response.status >= 200 && response.status < 300) {
		return response;
	} else {
		const error: any = new Error(response.statusText);
		error.response = response;
		throw error;
	}
}

function parseAsText(response) {
	return response.text();
}
