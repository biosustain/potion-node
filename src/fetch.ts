import {Observable} from 'rxjs/Observable';
import 'rxjs/add/observable/fromPromise';
import {PotionBase} from "./potion";

export class Potion extends PotionBase {
	constructor(options?) {
		super(Object.assign({prefix: 'http://localhost', options}));
	}
	fetch(uri, {method = 'GET'}: RequestInit = {}): Observable<any> {
		// Use isomorphic fetch for making requests,
		// see https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch for API.
		// https://www.npmjs.com/package/isomorphic-fetch
		const resource = fetch(uri, <RequestInit>{method}).then((response) => response.json());

		return Observable.fromPromise(resource);
	}
}
