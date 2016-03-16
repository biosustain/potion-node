import {Observable} from 'rxjs/Observable';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/operator/map';
import {PotionBase} from "./potion";

require('isomorphic-fetch');


export class Potion extends PotionBase {
	fetch(uri, {method} = {method: 'GET'}): Observable<any> {

		console.log(uri, method);
		// Use isomorphic fetch for making requests,
		// see https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch for API.
		// https://www.npmjs.com/package/isomorphic-fetch
		const resource = fetch(uri, {method}).then((response) => response.json());

		return Observable.fromPromise(resource);
	}
}
