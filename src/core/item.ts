import {
    getPotionInstance,
    getPotionURI,
    isAsync,
    isReadonly
} from './metadata';
import {QueryParams, RequestOptions} from './potion';
import {isJsObject} from './utils';


export interface ItemOptions {
    'readonly'?: string[];
    async?: string[];
}

export type ItemFetchOptions = Pick<RequestOptions, 'cache'>;
export type ItemQueryOptions = Pick<RequestOptions, 'cache' | 'paginate'>;

export interface ItemInitArgs {
    [key: string]: any;
}

/**
 * Base resource class for API resources.
 * Extending this class will make all resource operations available on the child classes.
 * NOTE: This is an abstract class and cannot be directly initiated.
 *
 * @example
 * class User extends Item {}
 *
 * User.fetch<User>(1)
 *     .then(async user => {
 *         await user.update({name: 'John Doe'});
 *     });
 *
 * const fred = new User({name: 'Fred'});
 * fred.save();
 *
 * const jane = User.fetch<User>(1);
 * jane.then(async jane => {
 *     jane.alias = 'Joe';
 *     await jane.save();
 * });
 *
 * User.query().then((users) => {
 *     users[0].destroy();
 * });
 */
export abstract class Item {
    [key: string]: any;

    /**
     * Get a resource by id.
     * @param id
     * @param options
     * @param [options.cache=true] - Setting it to `true` will ensure that the item will be fetched from cache if it exists and the HTTP request is cached.
     */
    static fetch<T extends Item>(id: number | string, {cache = true}: ItemFetchOptions = {}): Promise<T> {
        const uri: string = getPotionURI(this);
        const potion = getPotionInstance(this);
        return potion.fetch(`${uri}/${id}`, {
            method: 'GET',
            cache
        });
    }

    /**
     * Query resources.
     * @param [queryParams] - Can be used to manipulate the pagination with {page: number, perPage: number},
     * but it can also be used to further filter the results with {sort: any, where: any}.
     * @param options
     * @param [options.paginate=false] - Setting {paginate: true} will result in the return value to be a Pagination object.
     * @param [options.cache=true] - Cache the HTTP request.
     */
    static query<T extends Item, R = T[]>(queryParams?: QueryParams | null, {paginate = false, cache = true}: ItemQueryOptions = {}): Promise<R> {
        const uri: string = getPotionURI(this);
        const potion = getPotionInstance(this);
        return potion.fetch(uri, {
            method: 'GET',
            params: queryParams,
            paginate,
            cache
        });
    }

    /**
     * Get the first item.
     * @param [queryOptions] - Can be used to manipulate the pagination with {page: number, perPage: number},
     * but it can also be used to further filter the results with {sort: any, where: any}.
     */
    static async first<T extends Item>(queryOptions?: QueryParams): Promise<T> {
        try {
            const items = await this.query(queryOptions);
            return items[0] as T;
        } catch (err) {
            throw err;
        }
    }

    private $uri: string;
    private $id: number | string | null = null;

    /**
     * Create an instance of the class that extended the Item.
     * @param properties - An object with any properties that will be added and accessible on the resource.
     */
    constructor(properties?: ItemInitArgs) {
        if (isJsObject(properties)) {
            Object.assign(this, properties);
        }
    }

    get uri(): string {
        return this.$uri;
    }
    get id(): number | string | null {
        return this.$id;
    }

    /**
     * Compare current resource with another object.
     * @param resource
     */
    equals(resource: any): boolean {
        if (resource instanceof Item) {
            return this.id === resource.id && this.constructor.name === resource.constructor.name;
        }
        return false;
    }

    /**
     * Get the JSON repr. of this item.
     */
    toJSON(): any {
        return Object.entries(this)
            .filter(([key]) => !key.startsWith('$') && !isReadonly<this>(this, key) && !isAsync(this.constructor as typeof Item, key))
            .reduce((acc, [key, value]) => ({
                ...acc,
                [key]: value
            }), {});
    }

    /**
     * Save the current item.
     */
    async save(): Promise<this> {
        const json = this.toJSON();
        try {
            if (this.uri || this.id) {
                const updatedJSON = await this.update(json);
                return updatedJSON;
            } else {
                const ctor = this.constructor as typeof Item;
                const potion = getPotionInstance(ctor);
                const uri = getPotionURI(ctor);
                const resource = await potion.fetch(uri, {
                    method: 'POST',
                    body: json,
                    cache: true
                });
                return resource;
            }
        } catch (err) {
            throw err;
        }
    }

    /**
     * Update the resource.
     * @param data - An object with any properties to update.
     */
    async update(data: any = {}): Promise<this> {
        const potion = getPotionInstance(this.constructor as typeof Item);
        return potion.fetch(this.uri, {
            cache: true,
            method: 'PATCH',
            body: data
        });
    }

    /**
     * Destroy the current item.
     */
    async destroy(): Promise<void> {
        const uri = this.uri;
        const potion = getPotionInstance(this.constructor as typeof Item);
        const cache = potion.cache;
        try {
            await potion.fetch(uri, {method: 'DELETE'});
            // Clear the item from cache if exists
            if (cache.get(uri)) {
                cache.remove(uri);
            }
        } catch (err) {
            throw err;
        }
    }
}
