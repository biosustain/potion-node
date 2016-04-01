import {
	PotionFetchOptions,
	PotionBase
} from './base';
import {pairsToObject, toCamelCase} from './utils';


export class Potion extends PotionBase {
	fetch(uri, options?: PotionFetchOptions): Promise<any> {
		// Use isomorphic fetch for making requests,
		// see https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch for API.
		// https://github.com/github/fetch

		const {method, data, cache} = options || {method: 'GET', data: null, cache: 'default'};
		const init: RequestInit = {method, cache};

		// Make sure cookies are sent
		// https://github.com/github/fetch#sending-cookies
		init.credentials = 'include';

		if (data) {
			// POST/PUT
			// https://github.com/github/fetch#post-json
			init.body = JSON.stringify(options.data);
			init.headers = {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			};
		}

		return fetch(uri, init)
				.then(checkStatus)
				.then(parseAsText)
				.then(parseAsJson);
	}

	fromPotionJSON(json: any): Promise<any> {
		if (typeof json === 'object' && json !== null) {
			if (json instanceof Array) {
				return Promise.all(json.map((item) => this.fromPotionJSON(item)));
			} else if (typeof json.$uri === 'string') {
				const {resource, uri} = this.parseURI(json.$uri);
				const promises = [];

				for (const key of Object.keys(json)) {
					if (key === '$uri') {
						promises.push(Promise.resolve([key, uri]));
						// } else if (constructor.deferredProperties && constructor.deferredProperties.includes(key)) {
						// 	converted[toCamelCase(key)] = () => this.fromJSON(value[key]);
					} else {
						promises.push(this.fromPotionJSON(json[key]).then((value) => {
							return [toCamelCase(key), value];
						}));
					}
				}

				return Promise.all(promises).then((propertyValuePairs) => {
					const properties: any = pairsToObject(propertyValuePairs); // `propertyValuePairs` is a collection of [key, value] pairs
					const obj = {};

					Object
						.keys(properties)
						.filter((key) => key !== '$uri')
						.forEach((key) => obj[key] = properties[key]);

					Object.assign(obj, {uri: properties.$uri});

					let instance = Reflect.construct(<any>resource, [obj]);
					if (this.cache && this.cache.set) {
						this.cache.set(uri, <any>instance);
					}

					return instance;
				});
			} else if (Object.keys(json).length === 1) {
				if (typeof json.$ref === 'string') {
					let {uri} = this.parseURI(json.$ref);
					return this.get(uri);
				} else if (typeof json.$date !== 'undefined') {
					return Promise.resolve(new Date(json.$date));
				}
			}

			const promises = [];

			for (const key of Object.keys(json)) {
				promises.push(this.fromPotionJSON(json[key]).then((value) => {
					return [toCamelCase(key), value];
				}));
			}

			return Promise.all(promises).then((propertyValuePairs) => {
				return pairsToObject(propertyValuePairs);
			});
		} else {
			return Promise.resolve(json);
		}
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

function parseAsJson(text: string): any {
	let json;

	try {
		json = JSON.parse(text);
	} catch (e) {
		json = null;
	}

	return json;
}
