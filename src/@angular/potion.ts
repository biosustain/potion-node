import {Injectable, Inject, OpaqueToken} from '@angular/core';
import {
	RequestOptions,
	RequestOptionsArgs,
	Request,
	Response,
	URLSearchParams,
	QueryEncoder,
	Headers
} from '@angular/http';

import {Observable} from 'rxjs/Observable';
import 'rxjs/add/operator/toPromise';

import {
	RequestOptions as PotionRequestOptions,
	PotionOptions,
	PotionBase,
	Item,
	ItemOptions
} from '../core';

import {merge, isEmpty} from '../utils';


/**
 * Angular 2 Potion resources interface.
 */
export const POTION_RESOURCES = new OpaqueToken('POTION_RESOURCES');
export interface PotionResources {
	[key: string]: typeof Item | [typeof Item, ItemOptions];
}


/**
 * Provide a way to configure Potion in Angular 2.
 */
export const POTION_CONFIG = new OpaqueToken('POTION_CONFIG');
export interface PotionConfig extends PotionOptions {}


/**
 * Potion can also be configured to use various Angular 2 Http implementations.
 * This is useful when there is a wrapper around the core Angular 2 Http module (mostly needed when creating interceptors).
 */
export const POTION_HTTP = new OpaqueToken('POTION_HTTP');
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
	constructor(
		// TODO: fix when https://github.com/angular/angular/issues/12631 is fixed
		@Inject(POTION_CONFIG) config: any,
		@Inject(POTION_HTTP) private http: any
	) {
		super(config);
	}

	registerFromProvider(resources: PotionResources[]): void {
		resources = merge(
			// Remove any values that contain no resources
			resources.filter((item) => !isEmpty(item))
		);

		if (!isEmpty(resources)) {
			for (let [uri, type] of (Object as any).entries(resources)) {
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

	protected request(uri: string, {method = 'GET', search, data}: PotionRequestOptions = {}): Promise<any> {
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

			for (let [key, value] of (Object as any).entries(search)) {
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
			.toPromise()
			.then((response: any) => {
				let headers = {};
				let data;

				// If `response` is a Response object,
				// we might also have a Headers instance which we need to convert into an object.
				// NOTE: response can also be null.
				if (response instanceof Response) {
					if (response.headers instanceof Headers) {
						for (let key of response.headers.keys()) {
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
					if (response.text().length) {
						data = response.json();
					} else {
						data = null;
					}
				} else {
					data = response;
				}

				return {
					headers,
					data
				};
			});
	}
}
