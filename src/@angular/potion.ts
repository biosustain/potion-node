// tslint:disable: max-classes-per-file

import {
	Inject,
	Injectable,
	InjectionToken,
	Optional,
	Provider,
	SkipSelf
} from '@angular/core';
import {
	Headers,
	Http,
	QueryEncoder,
	Request,
	RequestOptions,
	RequestOptionsArgs,
	Response,
	URLSearchParams
} from '@angular/http';

import {Observable} from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/toPromise';

import {
	Item,
	ItemOptions,
	PotionBase,
	PotionOptions,
	RequestOptions as PotionRequestOptions
} from '../core';

import {isObjectEmpty, merge} from '../core/utils';


/**
 * Angular 2 Potion resources interface.
 */
export const POTION_RESOURCES = new InjectionToken<PotionResources>('POTION_RESOURCES');
export interface PotionResources {
	[key: string]: typeof Item | [typeof Item, ItemOptions];
}


/**
 * Provide a way to configure Potion in Angular 2.
 */
export const POTION_CONFIG = new InjectionToken<PotionConfig>('POTION_CONFIG');
export interface PotionConfig extends PotionOptions {} // tslint:disable-line:no-empty-interface


/**
 * Potion can also be configured to use various Angular 2 Http implementations.
 * This is useful when there is a wrapper around the core Angular 2 Http module (mostly needed when creating interceptors).
 */
export const POTION_HTTP = new InjectionToken<PotionHttp>('POTION_HTTP');
export interface PotionHttp {
	request(url: string | Request, options?: RequestOptionsArgs): Observable<Response>;
}


/**
 * Potion queries need special encoding (some queries have JSON objects as values for keys).
 */
export class PotionQueryEncoder extends QueryEncoder {
	encodeKey(key: string): string {
		return encodeURIComponent(key);
	}

	encodeValue(value: string): string {
		return encodeURIComponent(
			JSON.stringify(value)
		);
	}
}


/**
 * Angular 2 Potion provider.
 */
@Injectable()
export class Potion extends PotionBase {
	private http: PotionHttp;

	constructor(
		http: Http,
		// TODO: fix when https://github.com/angular/angular/issues/12631 is fixed
		@Optional() @Inject(POTION_CONFIG) config: any,
		@Optional() @Inject(POTION_HTTP) customHttp: any
	) {
		super(config || {});
		// Use custom Http class if provided,
		// fallback to Angular Http otherwise.
		this.http = customHttp || http;
	}

	registerFromProvider(resources: PotionResources[]): void {
		// Remove any values that contain no resources.
		resources = merge(...resources.filter(item => !isObjectEmpty(item)));

		if (!isObjectEmpty(resources)) {
			for (const [uri, type] of Object.entries(resources)) {
				// NOTE: Skip registration of existing resources.
				if (!this.resources.hasOwnProperty(uri)) {
					// `type` can be a tuple with resource type and a configuration for the resource type
					if (Array.isArray(type)) {
						const [resource, config] = type;
						this.register(uri, resource, config);
					} else {
						this.register(uri, type);
					}
				}
			}
		}
	}

	protected request(uri: string, options?: PotionRequestOptions): Promise<any> {
		const {search, data, method = 'GET'}: PotionRequestOptions = {...options};

		let requestOptions = new RequestOptions({
			method: method as string,
			url: uri
		});

		// We need to convert the {body} to proper JSON when making POST requests.
		if (data) {
			const headers = new Headers();
			// Potion also expects all requests to have content type set to 'application/json'.
			headers.set('Content-Type', 'application/json; charset=utf-8');
			requestOptions = requestOptions.merge({
				body: JSON.stringify(data),
				headers
			});
		}

		// Convert {search} to URLSearchParams.
		if (search) {
			const params = new URLSearchParams('', new PotionQueryEncoder());

			for (const [key, value] of Object.entries(search)) {
				// We need to `encodeURIComponent()` when we have complex search queries.
				// E.g. `search: {where: {foo: 1, bar: 2}}`, when URLSearchParams will be sent with the request,
				// it will end up as `[object Object]`, thus, we need to encode the value.
				params.append(key, value);
			}

			requestOptions = requestOptions.merge({
				search: params
			});
		}

		return this.http.request(uri, requestOptions)
			.map((response: any) => {
				let headers: {[key: string]: any} = {};
				let data;

				// If `response` is a Response object,
				// we might also have a Headers instance which we need to convert into an object.
				// NOTE: response can also be null.
				if (response instanceof Response) {
					if (response.headers instanceof Headers) {
						for (const key of response.headers.keys()) {
							// Angular 2 does not yet lowercase headers.
							// Make sure we get the first string value of the header instead of the array of values.
							headers[key.toLowerCase()] = response.headers.get(key);
						}
					} else {
						// NOTE: headers must be an object,
						// thus the fallback.
						headers = response.headers || {};
					}
					// We cannot parse as JSON when there is a response with empty text (e.g. 204 NO CONTENT),
					// therefore, we set the data to null to avoid exceptions being thrown.
					data = response.text().length > 0 ? response.json() : null;
				} else {
					data = response;
				}

				return {
					headers,
					data
				};
			})
			.toPromise();
	}
}


export function POTION_PROVIDER_FACTORY(parentFactory: Potion, http: Http, config: PotionConfig, customHttp: PotionHttp): Potion {
	return parentFactory || new Potion(http, config, customHttp);
}

export const POTION_PROVIDER: Provider = {
	// If there is already a Potion available, use that.
	// Otherwise, provide a new one.
	provide: Potion,
	useFactory: POTION_PROVIDER_FACTORY,
	deps: [
		[new Optional(), new SkipSelf(), Potion],
		Http,
		[new Optional(), new Inject(POTION_CONFIG)],
		[new Optional(), new Inject(POTION_HTTP)]
	]
};
