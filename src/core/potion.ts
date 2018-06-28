// tslint:disable: max-file-line-count
import {
    async,
    getPotionPromiseCtor,
    isAsync,
    readonly,
    setPotionInstance,
    setPotionURI
} from './metadata';
import {Item, ItemOptions} from './item';
import {Pagination} from './pagination';
import {
    addPrefixToURI,
    findPotionResource,
    findRoots,
    fromSchemaJSON,
    getErrorMessage,
    getPotionID,
    getPotionURI,
    hasTypeAndId,
    isFunction,
    isPotionURI,
    isString,
    LazyPromiseRef,
    MemCache,
    parsePotionID,
    removePrefixFromURI,
    replaceReferences,
    toCamelCase,
    toPotionJSON,
    toSelfReference
} from './utils';

function skipProperty(object: any, skipProperties: string[]): void {
    const keys = Object.keys(object);
    for (const key of keys) {
        const isSkip = skipProperties.find(property => property === toCamelCase(key)) !== undefined;
        if (isSkip) {
            delete object[key];
            // TODO decide to delete key or set to undefined?
        }
    }
}

/**
 * Item cache.
 * Dictates the implementation of the item cache.
 */
export interface ItemCache<T extends Item> {
    has(key: string): boolean;
    get(key: string): Promise<T>;
    put(key: string, item: Promise<T>): Promise<T>;
    remove(key: string): void;
}


/**
 * Common interfaces.
 */

export interface ParsedURI {
    resource: typeof Item;
    id: string | number |  null;
    uri: string;
}

// TODO: Start using a more standard impl. of these interfaces (either create proper classes for some or use the native Request, etc.)
export interface URLSearchParams {
    [key: string]: any;
}

export interface RequestOptions {
    method?: 'OPTIONS' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'GET' | 'DELETE' | 'JSONP';
    params?: URLSearchParams | QueryParams | null;
    body?: any;
    cache?: boolean;
    paginate?: boolean;
    skip?: string[];
}
export interface QueryParams {
    page?: number;
    perPage?: number;
    where?: any;
    sort?: any;
}

export interface FetchExtras {
    pagination?: Pagination<any>;
    origin?: string[];
}

export type FetchOptions = RequestOptions & FetchExtras;


export interface PotionResponse {
    headers: any;
    body: any;
}

export interface PotionOptions {
    host?: string;
    prefix?: string;
    cache?: ItemCache<Item>;
}

export interface PotionResources {
    [key: string]: typeof Item;
}


/**
 * This class contains the main logic for interacting with the Flask Potion backend.
 * Note that this class does not contain the logic for making the HTTP requests,
 * it is up to the child class to implement the logic for that through the `request` method.
 * Furthermore, the child class also needs to provide the Promise class/fn as this class is set to use the native Promise only available from ES6.
 *
 * @example
 * class Potion extends PotionBase {
 *     protected request(uri, options?: RequestOptions): Promise<any> {
 *         // Here we need to implement the actual HTTP request
 *     };
 * }
 */
export abstract class PotionBase {
    readonly resources: PotionResources = {};
    readonly cache: ItemCache<Item>;
    host: string;
    readonly prefix: string;

    private readonly Promise: typeof Promise = getPotionPromiseCtor(this); // NOTE: This is needed only to provide support for AngularJS.
    private requests: Map<string, any> = new Map();

    constructor({host = '', prefix = '', cache}: PotionOptions = {}) {
        this.cache = cache || new MemCache();
        this.host = host;
        this.prefix = prefix;
    }

    /**
     * Register a resource.
     * @param uri - Path on which the resource is registered.
     * @param resource
     * @param options - Set the property options for any instance of the resource (setting a property to readonly for instance).
     */
    register(uri: string, resource: typeof Item, options?: ItemOptions): typeof Item {
        if (!isFunction(resource)) {
            throw new TypeError(`An error occurred while trying to register a resource for ${uri}. ${resource} is not a function.`);
        }

        // Set the Potion instance and URI on the resource
        setPotionInstance(resource, this);
        setPotionURI(resource, uri);

        // Set readonly properties
        if (options && Array.isArray(options.readonly)) {
            for (const property of options.readonly) {
                readonly(resource, property);
            }
        }

        // Set async properties
        if (options && Array.isArray(options.async)) {
            for (const property of options.async) {
                async(resource, property);
            }
        }

        // Register the resource
        this.resources[uri] = resource;

        return resource;
    }

    /**
     * Register a resource.
     * @param uri - Path on which the resource is registered.
     * @param options - Set the property options for any instance of the resource (setting a property to readonly for instance).
     *
     * @example
     * @potion.registerAs('/user')
     * class User extends Item {}
     */
    registerAs(uri: string, options?: ItemOptions): ClassDecorator {
        return (target: any) => {
            this.register(uri, target, options);
            return target;
        };
    }

    /**
     * Get a resource by item uri
     * @param uri
     */
    resource(uri: string): typeof Item | undefined {
        const entry = findPotionResource(uri, this.resources);
        if (entry) {
            return entry.resource;
        }
    }

    /**
     * Make a HTTP request.
     * @param uri
     * @param options
     * @returns An object with {body, headers} where {body} can be anything and {headers} is an object with the response headers from the HTTP request.
     */
    protected abstract request(uri: string, options?: RequestOptions): Promise<PotionResponse>;

    // tslint:disable-next-line: member-ordering
    fetch(uri: string, requestOptions?: RequestOptions, extras?: FetchExtras): Promise<Item | Item[] | Pagination<Item> | any> {
        const origin = removePrefixFromURI(uri, this.prefix);
        const options = {...requestOptions, ...extras, origin: []};
        if (isPotionURI(uri, this.resources)) {
            Object.assign(options, {
                origin: [origin]
            });
        }
        return this.resolve(uri, options)
            .then(json => {
                replaceReferences(json, findRoots(json));
                return json;
            });
    }

    private resolve(uri: string, options: FetchOptions): Promise<any> {
        const prefix = this.prefix;
        const Promise = this.Promise;

        const cacheKey = removePrefixFromURI(uri, prefix);
        // Add the API prefix if not present
        uri = addPrefixToURI(uri, prefix);

        // Serialize request to Potion JSON.
        const fetch = () => this.request(`${this.host}${uri}`, this.serialize(options))
            // Deserialize the Potion JSON.
            .then(response => this.deserialize(response, uri, options));

        if (options.method === 'GET' && !options.paginate && !options.params) {
            // If a GET request was made and {cache: true} return the item from cache (if it exists).
            // NOTE: Queries are not cached.
            if (options.cache && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            // Cache the request so that further requests for the same resource will not make an aditional XHR.
            if (!this.requests.has(cacheKey)) {
                this.requests.set(cacheKey, fetch().then(data => {
                    this.requests.delete(cacheKey);
                    return data;
                }, err => {
                    // If request fails,
                    // make sure to remove the pending request so further requests can be made,
                    // but fail the pipeline.
                    this.requests.delete(cacheKey);
                    const message = getErrorMessage(err, uri);
                    return Promise.reject(message);
                }));
            }

            return this.requests.get(cacheKey);
        } else {
            return fetch();
        }

    }

    private serialize(options: FetchOptions): FetchOptions {
        const prefix = this.prefix;
        const {params} = options;

        return {
            ...options,
            ...{
                params: toPotionJSON(options.paginate ? {page: 1, perPage: 25, ...params} : params, prefix),
                body: toPotionJSON(options.body, prefix)
            }
        };
    }

    private deserialize({headers, body}: PotionResponse, uri: string, options: FetchOptions): Promise<PotionResponse> {
        // identify $refs to be skipped
        const {skip} = options;
        if (skip) {
            if (Array.isArray(body)) {
                for (const item of body) {
                    skipProperty(item, skip);
                }
            } else if (typeof(body) === 'object' && body !== null && body !== undefined) {
                skipProperty(body, skip);
            } else {
                console.warn('missing coverage for type: ', typeof(body)); // tslint:disable-line: no-console
            }
        }

        return this.fromPotionJSON(body, options.origin as string[])
            .then(json => {
                // If {paginate} is enabled, return or update Pagination.
                if (options.paginate) {
                    const count = headers['x-total-count'] || json.length;
                    if (options.pagination instanceof Pagination) {
                        return options.pagination.update(json, count);
                    } else {
                        const pagination = new Pagination<Item>({uri, potion: this}, json, count, options);
                        Object.assign(options, {pagination});
                        return pagination;
                    }
                }
                return json;
            });
    }

    private fromPotionJSON(
        json: any, origin:
        string[],
        {
            rootUri,
            key,
            replaceRefs
        }: {
            rootUri?: string;
            key?: string;
            replaceRefs?: boolean;
        } = {}): Promise<any> {
        const Promise = this.Promise;

        if (typeof json === 'object' && json !== null) {
            if (Array.isArray(json)) {
                // Try to find a matching registered resource for the root uri
                const resource = this.resource(rootUri as any);
                // Check if prop is lazy (it's possible the root is an array and not a resource at all)
                const isLazy = resource && isAsync(resource, key as string);
                const getter = (replaceRefs?: boolean) => Promise.all(json.map(item => this.fromPotionJSON(item, origin, {replaceRefs})));
                // If this property is async,
                // we return a lazy promise ref which will later be replaced with a getter.
                // NOTE: When the getter is called and resolved,
                // we will run the refs replacement fn again to ensure that any lazy promise props
                // on the resolved item(s) are also replaced with a getter.
                // Hence the usage of (replaceRefs?) arg on the getter.
                if (isLazy) {
                    return Promise.resolve(new LazyPromiseRef(getter));
                } else {
                    return getter(false);
                }
            } else if (isString(json.$uri) || hasTypeAndId(json)) {
                // NOTE: The json may also have {$type, $id} that can be used to recognize a resource instead of {$uri}.
                // If neither combination is provided it will throw.
                return this.parseURI(json)
                    .then(({resource, id, uri}) => {
                        const attrs = {$id: id, $uri: uri};

                        // Since we have a resource, we append to origin list (because later it will get replaced with itself).
                        if (!origin.includes(uri)) {
                            origin.push(uri);
                        }

                        const properties = this.parsePotionJSONProperties(json, origin);

                        // Create and cache the resource if it does not exist.
                        if (!this.cache.has(uri)) {
                            return this.cache.put(uri, properties.then((properties: {}) => Reflect.construct(resource, [{...properties, ...attrs}])));
                        } else {
                            // If the resource already exists,
                            // update it with new properties.
                            return Promise.all([properties, this.cache.get(uri)])
                                .then(([properties, item]) => {
                                    Object.assign(item, properties, attrs);
                                    return item;
                                });
                        }
                    });
            } else if (isString(json.$schema)) {
                // If we have a schema object,
                // we want to resolve it as it is and not try to resolve references or do any conversions.
                // Though, we want to convert snake case to camel case.
                return Promise.resolve(fromSchemaJSON(json));
            } else if (Object.keys(json).length === 1) {
                if (isString(json.$ref)) {
                    // A '#' ref is a self reference (to root object)
                    if (json.$ref === '#') {
                        return Promise.resolve(json.$ref);
                    }
                    return this.parseURI(json)
                        .then(({uri}) => {
                            if (origin.includes(uri)) {
                                return Promise.resolve(toSelfReference(uri));
                            }
                            // Try to find a matching registered resource for the root uri
                            const resource = this.resource(rootUri as any);
                            // NOTE: A property can be async if it has the @async decorator.
                            // To find if that is true,
                            // we check the async metadata on the resource
                            // and try to find a key by the key that was provided through .fromPotionJSON() or byt the uri for this $ref.
                            const isLazy = resource && isAsync(resource, key || uri);
                            // Lazy promise getter
                            const getter = () => this.fetch(uri, {
                                cache: true,
                                method: 'GET'
                            }, {origin});
                            // If this property is async,
                            // we return a lazy promise ref which will later be replaced with a getter.
                            if (isLazy) {
                                return new LazyPromiseRef(getter);
                            } else if (replaceRefs) {
                                return getter();
                            } else {
                                return this.resolve(uri, {
                                    cache: true,
                                    method: 'GET',
                                    origin
                                });
                            }
                        });
                } else if (typeof json.$date !== 'undefined') {
                    // Parse Potion date
                    return Promise.resolve(new Date(json.$date));
                }
            }

            return this.parsePotionJSONProperties(json, origin);
        } else {
            return Promise.resolve(json);
        }
    }
    private parsePotionJSONProperties(json: any, origin: string[]): any {
        const Promise = this.Promise;
        const entries = Object.entries(json);
        const values = entries.map(([key, value]) => this.fromPotionJSON(value, origin, {
            key,
            rootUri: json.$uri
        }));
        const keys = entries.map(([key]) => toCamelCase(key));

        return Promise.all(values)
            .then(values => values.map((value, index) => [keys[index], value])
                .reduce((a, [key, value]) => ({
                    ...a,
                    [key]: value
                }), {}));
    }

    // Try to parse a Potion URI and find the associated resource for it,
    // otherwise return a rejected promise.
    private parseURI({$ref, $uri, $type, $id}: {[key: string]: any}): Promise<ParsedURI> {
        const Promise = this.Promise;
        const uri = removePrefixFromURI(getPotionURI({$ref, $uri, $type, $id}), this.prefix);
        const entry = findPotionResource(uri, this.resources);

        if (!entry) {
            return Promise.reject(new Error(`URI '${uri}' is an uninterpretable or unknown Potion resource.`));
        } else {
            const {resourceURI, resource} = entry;
            const obj = {resource, uri, id: parsePotionID($id)};

            if (obj.id === null) {
                Object.assign(obj, {
                    id: getPotionID(uri, resourceURI)
                });
            }

            return Promise.resolve(obj);
        }
    }
}
