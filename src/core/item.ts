import {isReadonly, potionInstance, potionURI} from './metadata';
import {FetchOptions, QueryOptions} from './potion';
import {Pagination} from './pagination';


export interface ItemOptions {
	'readonly'?: string[];
}


/**
 * Base resource class for API resources.
 * Extending this class will make all resource operations available on the child classes.
 * NOTE: This is an abstract class and cannot be directly initiated.
 *
 * @example
 * class User extends Item {}
 *
 * User.fetch(1).then((user) => {
 *     user.update({name: 'John Doe'});
 * });
 *
 * const fred = new User({name: 'Fred'});
 * fred.save();
 *
 * const jane = User.fetch(1);
 * jane.then((jane) => {
 *     jane.alias = 'Joe';
 *     jane.save();
 * });
 *
 * User.query().then((users) => {
 *     users[0].destroy();
 * });
 */
export abstract class Item {
	/**
	 * Get a resource by id.
	 * @param {Number|String} id
	 * @param {boolean} {cache} - Setting it to `true` will ensure that the item will be fetched from cache if it exists and the HTTP request is cached.
	 */
	static fetch<T extends Item>(id: number | string, {cache = true}: FetchOptions = {}): Promise<T> {
		const uri: string = potionURI(this);
		return potionInstance(this).fetch(`${uri}/${id}`, {
			method: 'GET',
			cache
		});
	}

	/**
	 * Query resources.
	 * @param {QueryOptions|null} queryOptions - Can be used to manipulate the pagination with {page: number, perPage: number},
	 * but it can also be used to further filter the results with {sort: any, where: any}.
	 * @param {boolean} {paginate} - Setting {paginate: true} will result in the return value to be a Pagination object.
	 * @param {boolean} {cache} - Cache the HTTP request.
	 */
	static query<T extends Item>(queryOptions?: QueryOptions | null, {paginate = false, cache = true}: FetchOptions = {}): Promise<T[] | Pagination<T>> {
		const uri: string = potionURI(this);
		return potionInstance(this).fetch(uri, {
			method: 'GET',
			search: queryOptions,
			paginate,
			cache
		});
	}

	/**
	 * Get the first item.
	 */
	static first<T extends Item>(queryOptions?: QueryOptions): Promise<T> {
		return this.query(queryOptions)
			.then(first);
		function first(items: T[]): T {
			return items[0];
		}
	}

	private $uri: string;
	private $id: number | string | null = null;

	/**
	 * Create an instance of the class that extended the Item.
	 * @param {Object} properties - An object with any properties that will be added and accessible on the resource.
	 */
	constructor(properties: any = {}) {
		Object.assign(this, properties);
	}

	get uri(): string {
		return this.$uri;
	}
	get id(): number | string | null {
		return this.$id;
	}

	/**
	 * Compare current resource with another object.
	 * @param {Object} resource
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
		const properties = {};

		Object.keys(this)
			.filter(key => !key.startsWith('$') && !isReadonly(this.constructor, key))
			.forEach(key => {
				properties[key] = this[key];
			});

		return properties;
	}

	/**
	 * Save the current item.
	 */
	save(): Promise<this> {
		if (this.uri || this.id) {
			return this.update(this.toJSON());
		}
		const ctor = this.constructor as typeof Item;
		return potionInstance(ctor)
			.fetch(potionURI(ctor), {
			method: 'POST',
			data: this.toJSON(),
			cache: true
		});
	}

	/**
	 * Update the resource.
	 * @param {Object} data - An object with any properties to update.
	 */
	update(data: any = {}): Promise<this> {
		return potionInstance(this.constructor as typeof Item)
			.fetch(this.uri, {
			cache: true,
			method: 'PATCH',
			data
		});
	}

	/**
	 * Destroy the current item.
	 */
	destroy(): Promise<void> {
		const {uri} = this;
		const potion = potionInstance(this.constructor as typeof Item);
		const cache = potion.cache;
		return potion.fetch(uri, {method: 'DELETE'})
			.then(clearCache);
		function clearCache(): void {
			// Clear the item from cache if exists
			if (cache.get(uri)) {
				cache.remove(uri);
			}
		}
	}
}
