import {
	APP_INITIALIZER,
	Injectable,
	Inject,
	OpaqueToken,
	isDevMode
} from '@angular/core';

import {Observable} from 'rxjs/Observable';
import 'rxjs/add/operator/toPromise';

import {
	HTTP_PROVIDERS,
	Http,
	RequestOptions,
	RequestOptionsArgs,
	RequestMethod,
	Request,
	Response,
	URLSearchParams
} from '@angular/http';

import {
	RequestOptions as PotionRequestOptions,
	PotionOptions,
	PotionBase,
	Item,
	ItemOptions
} from './core';


export {Item, Route, readonly} from './core';


export const POTION_CONFIG = new OpaqueToken('PotionConfig');
export interface PotionConfig extends PotionOptions {}


export const POTION_HTTP = new OpaqueToken('PotionHttp');
export interface PotionHttp {
	request(url: string | Request, options?: RequestOptionsArgs): Observable<Response>;
}


@Injectable()
export class Potion extends PotionBase {
	constructor(
		@Inject(POTION_HTTP) private http: PotionHttp,
		@Inject(POTION_CONFIG) config: PotionConfig
	) {
		super(config);
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
				// We need to `encodeURIComponent()` when we have complex search queries.
				// E.g. `search: {where: {foo: 1, bar: 2}}`, when URLSearchParams will be sent with the request,
				// it will end up as `[object Object]`, thus, we need to encode the value.
				params.append(
					key,
					encodeURIComponent(
						// Convert the value to JSON as well.
						JSON.stringify(value)
					)
				);
			}

			requestOptions = requestOptions.merge({
				search: params
			});
		}

		// Create Request object.
		const request = new Request(requestOptions);

		return this.http.request(request).toPromise().then((response: any) => {
			let headers = {};

			// If `response` has is a Response object,
			// we might also have a Headers instance which we need to convert into an object.
			if (response.headers instanceof Headers) {
				for (let key of response.headers.keys()) {
					// Angular 2 does not yet lowercase headers.
					// Make sure we get the first string value of the header instead of the array of values.
					headers[key.toLowerCase()] = response.headers.get(key);
				}
			} else {
				headers = response.headers;
			}

			// `response` might be something other than a Response object
			const data = response instanceof Response
				? response.json()
				: response;

			return {
				data,
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
export function providePotion(resources: Resources): any[] {
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
							const [resource, config] = type;
							potion.register(uri, resource, config);
						} else {
							potion.register(uri, type);
						}
					}
				};
			},
			deps: [Potion],
			multi: true
		},
		{
			provide: POTION_CONFIG,
			useValue: {}
		},
		{
			provide: Potion,
			useClass: Potion,
			deps: [
				POTION_HTTP,
				POTION_CONFIG
			]
		},
		{
			provide: POTION_HTTP,
			useExisting: Http,
			deps: [
				HTTP_PROVIDERS
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
		useValue: {}
	},
	{
		provide: Potion,
		useClass: Potion,
		deps: [
			POTION_HTTP,
			POTION_CONFIG
		]
	},
	{
		provide: POTION_HTTP,
		useExisting: Http,
		deps: [
			HTTP_PROVIDERS
		]
	}
];
