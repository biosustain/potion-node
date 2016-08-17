import {Injectable, Inject, OpaqueToken} from '@angular/core';
import {
	RequestOptions,
	RequestOptionsArgs,
	RequestMethod,
	Request,
	Response,
	URLSearchParams,
	QueryEncoder
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
		@Inject(POTION_RESOURCES) resources: PotionResources[],
		@Inject(POTION_CONFIG) config: PotionConfig,
		@Inject(POTION_HTTP) private http: PotionHttp
	) {
		super(config);

		resources = merge(
			// Remove any values that contain no resources
			resources.filter((item) => !isEmpty(item))
		);

		if (!isEmpty(resources)) {
			for (let [uri, type] of (Object as any).entries(resources)) {
				// Tuple with resource type and a configuration for the resource type
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
			const params = new URLSearchParams('', new PotionQueryEncoder());

			for (let [key, value] of (Object as any).entries(search)) {
				// We need to `encodeURIComponent()` when we have complex search queries.
				// E.g. `search: {where: {foo: 1, bar: 2}}`, when URLSearchParams will be sent with the request,
				// it will end up as `[object Object]`, thus, we need to encode the value.
				params.append(key, value);
			}

			// TODO(rolandjitsu): Check https://github.com/angular/angular/issues/10235,
			// merging will cause our PotionQueryEncoder to never actually get called,
			// use merging when the bug it's fixed.
			const {url, method, body} = requestOptions as any;
			requestOptions = new RequestOptions({
				url,
				method,
				search: params,
				body
			});
			// requestOptions = requestOptions.merge({
			// 	search: params
			// });

		}

		return this.http.request(uri, requestOptions).toPromise().then((response: any) => {
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
