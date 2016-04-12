import {
	Inject,
	Injectable,
	OpaqueToken,
	Provider
} from 'angular2/core';
import {Http} from 'angular2/http';

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

	request(uri, options?: PotionRequestOptions): Promise<any> {
		throw 'Not implemented';
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
