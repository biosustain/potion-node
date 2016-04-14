import {
	Inject,
	Injectable,
	OpaqueToken,
	Provider
} from 'angular2/core';
import {
	Http,
	RequestOptions,
	RequestMethod,
	Request,
	Response
} from 'angular2/http';

import {Observable} from 'rxjs/Observable';
import 'rxjs/add/operator/toPromise';

import {
	PotionRequestOptions,
	PotionOptions,
	PotionBase
} from './base';

import {MemCache} from './utils';


export {
	Item,
	Route
} from './base';

export let POTION_CONFIG = new OpaqueToken('potion.config');
export interface PotionConfig extends PotionOptions {}

@Injectable()
export class Potion extends PotionBase {
	_http: Http;

	constructor(http: Http, @Inject(POTION_CONFIG) config: PotionConfig) {
		super(config);
		this._http = http;
	}

	request(uri, {method = 'GET', data = null}: PotionRequestOptions = {}): Promise<any> {
		// Angular Http Request accepts a RequestMethod type for a method,
		// but the value for that is an integer.
		// Therefore we need to match the string literals like 'GET' to the enum values for RequestMethod.
		let request = new RequestOptions({
			method: parseInt((<any>Object).entries(RequestMethod).find((entry) => entry[1].toLowerCase() === (<string>method).toLowerCase())[0], 10),
			url: uri
		});

		if (data) {
			request.merge({
				body: JSON.stringify(data)
			});
		}

		/* tslint:disable: align */
		let obs = new Observable((observer) => {
			let subscriber = this._http.request(new Request(request)).subscribe((response: Response) => {
				// TODO: handle errors
				observer.next({
					headers: response.headers ? JSON.parse(<any>response.headers.toJSON()) : {},
					data: response.json()
				});
				observer.complete();
			}, (error) => observer.error(error));

			return () => {
				subscriber.unsubscribe();
			};
		});
		/* tslint:enable: align */

		return obs.toPromise();
	}
}

export const POTION_PROVIDERS = [
	new Provider(POTION_CONFIG, {
		useValue: {
			prefix: '/api',
			cache: new MemCache()
		}
	}),
	new Provider(Potion, {
		useClass: Potion,
		deps: [
			Http,
			POTION_CONFIG
		]
	})
];
