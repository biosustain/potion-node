import {
	APP_INITIALIZER,
	Injectable,
	Inject,
	OpaqueToken,
	isDevMode
} from '@angular/core';
import 'rxjs/add/operator/toPromise';
import {
	Http,
	RequestOptions,
	RequestMethod,
	Request,
	Response,
	URLSearchParams
} from '@angular/http';

import {MemCache} from './utils';
import {
	RequestOptions as PotionRequestOptions,
	PotionOptions,
	PotionBase,
	Item,
	ItemOptions
} from './core';


export {Item, Route, readonly} from './core';


export let POTION_CONFIG = new OpaqueToken('PotionConfig');
export interface PotionConfig extends PotionOptions {}


@Injectable()
export class Potion extends PotionBase {
	private http: Http;

	constructor(http: Http, @Inject(POTION_CONFIG) config: PotionConfig) {
		super(config);
		// Use Angular 2 Http for requests
		this.http = http;
	}

	protected request(uri: string, {method = 'GET', search, data}: PotionRequestOptions = {}): Promise<any> {
		// Angular Http Request accepts a RequestMethod type for a method,
		// but the value for that is an integer.
		// Therefore we need to match the string literals like 'GET' (coming from Potion) to the enum values for RequestMethod.
		let requestOptions = new RequestOptions({
			method: parseInt(
				(Object as any)
					.entries(RequestMethod)
					.find((entry) => entry[1].toLowerCase() === (method as string).toLowerCase())[0],
				10
			),
			url: uri
		});

		// We need to convert the {body} to proper JSON when making POST requests.
		if (data) {
			requestOptions = requestOptions.merge({
				body: JSON.stringify(data)
			});
		}

		// Convert {search} to URLSearchParams.
		if (search) {
			const params = new URLSearchParams();

			for (let [key, value] of (Object as any).entries(search)) {
				params.append(key, value);
			}

			requestOptions = requestOptions.merge({
				search: params
			});
		}

		// Create Request object.
		const request = new Request(requestOptions);

		return this.http.request(request).toPromise().then((response: Response) => {
			const headers = {};

			if (response.headers) {
				for (let key of response.headers.keys()) {
					// Angular 2 does not yet lowercase headers.
					// Make sure we get the first string value of the header instead of the array of values.
					headers[key.toLowerCase()] = response.headers.get(key);
				}
			}

			return {
				data: response.json(),
				headers
			};
		});
	}
}


export interface Resources {
	[key: string]: typeof Item | [typeof Item, ItemOptions];
}

/**
 * Provide a way to register resources when the app is bootstrapped.
 *
 * @example
 * bootstrap(App, [
 * 	   providePotion({
 * 	       '/engine': Engine,
 * 	       '/car': [Car, {
 * 	           readonly: ['production']
 * 	       }]
 * 	   })
 * ])
 */
export function providePotion(resources: Resources, config?: PotionConfig): any[] {
	return [
		{
			// We do this because we want to initialize Potion before it is used by any component,
			// and register resources.
			provide: APP_INITIALIZER,
			useFactory: (potion: Potion) => {
				return () => {
					if (isDevMode()) {
						console.info('Potion resources have been registered.');
					}

					for (let [uri, type] of (Object as any).entries(resources)) {
						// Tuple with resource type and a configuration
						if (Array.isArray(type)) {
							let [resource, config] = type;
							potion.register(uri, resource, config);
						} else {
							potion.register(uri, type);
						}
					}
				};
			},
			deps: [
				Potion
			],
			multi: true
		},
		{
			provide: POTION_CONFIG,
			useValue: config || {
				cache: new MemCache()
			}
		},
		{
			provide: Potion,
			useClass: Potion,
			deps: [
				Http,
				POTION_CONFIG
			]
		}
	];
}


export const POTION_PROVIDERS = [
	{
		// We do this because we want to initialize Potion before it is used by any component.
		provide: APP_INITIALIZER,
		useFactory: (potion: Potion) => {
			return () => {
				if (isDevMode()) {
					console.info('Potion has been initialized.');
				}
			};
		},
		deps: [
			Potion
		],
		multi: true
	},
	{
		provide: POTION_CONFIG,
		useValue: {
			cache: new MemCache()
		}
	},
	{
		provide: Potion,
		useClass: Potion,
		deps: [
			Http,
			POTION_CONFIG
		]
	}
];
