import {
	Inject,
	Injectable,
	InjectionToken,
	Optional,
	Provider,
	SkipSelf
} from '@angular/core';
import {
	HttpClient,
	HttpHeaders,
	HttpRequest,
	HttpResponse
} from '@angular/common/http';

// TODO: Let's not polute the global rxjs, so we should import the operator fns and apply properly
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/toPromise';

import {Item, ItemOptions} from '../core/item';
import {PotionBase, PotionOptions, RequestOptions} from '../core/potion';
import {isJsObject, isObjectEmpty, merge, omap} from '../core/utils';


/**
 * Token for providing the Potion resources to be registered
 * NOTE: This is a multi provider.
 */
export const POTION_RESOURCES = new InjectionToken<PotionResources>('PotionResources');
export interface PotionResources {
	[key: string]: typeof Item | [typeof Item, ItemOptions];
}


/**
 * Token for configuring Potion
 */
export const POTION_CONFIG = new InjectionToken<PotionConfig>('PotionConfig');
export interface PotionConfig extends PotionOptions {} // tslint:disable-line:no-empty-interface


/**
 * Potion provider for Angular
 * NOTE: This does not need to be injected anywhere in the app
 */
@Injectable()
export class Potion extends PotionBase {
	constructor(private http: HttpClient, @Optional() @Inject(POTION_CONFIG) config: PotionConfig) {
		super({...config});
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

	protected request(uri: string, options?: RequestOptions): Promise<any> {
		const {params, body, method = 'GET'}: RequestOptions = {...options};

		// Create a HttpRequest
		let request = new HttpRequest(method as any, uri, {
			// Potion expects all requests to have content type set to 'application/json'.
			headers: new HttpHeaders({
				'Content-Type': 'application/json'
			}),
			responseType: 'json'
		});

		if (body) {
			// We need to convert the {body} to proper JSON when making POST/PUT/PATCH requests.
			request = request.clone({
				body: JSON.stringify(body)
			});
		}

		// Convert {params} to HttpParams.
		if (isJsObject(params)) {
			request = request.clone({
				setParams: omap(params, key => key, value => JSON.stringify(value))
			});
		}

		return this.http.request(request)
			.filter(event => event instanceof HttpResponse)
			.map((response: HttpResponse<any>) => {
				const body = response.body;

				// Set headers
				const headers: {[key: string]: any} = {};
				for (const key of response.headers.keys()) {
					headers[key] = response.headers.get(key);
				}

				return {
					headers,
					body
				};
			})
			.toPromise();
	}
}


export function POTION_PROVIDER_FACTORY(parentFactory: Potion, http: HttpClient, config: PotionConfig): Potion {
	return parentFactory || new Potion(http, config);
}

export const POTION_PROVIDER: Provider = {
	// If there is already a Potion service available, use that.
	// Otherwise, provide a new one.
	provide: Potion,
	useFactory: POTION_PROVIDER_FACTORY,
	deps: [
		[new Optional(), new SkipSelf(), Potion],
		HttpClient,
		[new Optional(), new Inject(POTION_CONFIG)]
	]
};
