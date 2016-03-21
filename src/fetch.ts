import {
	PotionBase
} from "./potion";

export class Potion extends PotionBase {
	fetch(uri, {method = 'GET'}: RequestInit = {}): Promise<any> {
		// Use isomorphic fetch for making requests,
		// see https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch for API.
		// https://www.npmjs.com/package/isomorphic-fetch
		return fetch(uri, <RequestInit>{method}).then((response) => response.json());
	}
}
