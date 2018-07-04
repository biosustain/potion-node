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
    HttpParams,
    HttpRequest,
    HttpResponse
} from '@angular/common/http';

import {filter} from 'rxjs/operators/filter';
import {map} from 'rxjs/operators/map';

import {Item, ItemOptions} from '../core/item';
import {PotionBase, PotionOptions, RequestOptions} from '../core/potion';
import {isJsObject, isObjectEmpty, merge} from '../core/utils';


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
                        this.register(uri, type as any);
                    }
                }
            }
        }
    }

    protected request(uri: string, options?: RequestOptions): Promise<any> {
        const {params, body, method = 'GET'}: RequestOptions = {...options};

        const init: any = {
            // Potion expects all requests to have content type set to 'application/json'.
            headers: new HttpHeaders({
                'content-type': 'application/json'
            }),
            responseType: 'json'
        };

        // Convert {params} to HttpParams.
        if (isJsObject(params)) {
            let httpParams = new HttpParams();
            for (const [key, value] of Object.entries(params)) {
                // HttpParams, like all http client classes, are immutable, hence the assignment
                httpParams = httpParams.append(key, JSON.stringify(value));
            }
            Object.assign(init, {
                params: httpParams
            });
        }

        const request = method === 'POST' || method === 'PUT' || method === 'PATCH' ? new HttpRequest(method as any, uri, toJson(body), init) : new HttpRequest(method as any, uri, init);

        return this.http.request(request)
            .pipe<any, any>(filter(event => event instanceof HttpResponse), map((response: HttpResponse<any>) => {
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
            }))
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


function toJson(value: any): any {
    try {
        return JSON.stringify(value);
    } catch (e) {
        return;
    }
}
