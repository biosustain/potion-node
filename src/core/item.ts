import {isReadonly, potionInstance, potionURI} from './metadata';
import {FetchOptions, PotionBase, QueryOptions} from './potion';
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
 * let fred = new User({name: 'Fred'});
 * fred.save();
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
	private potion: PotionBase;

	/**
	 * Create an instance of the class that extended the Item.
	 * @param {Object} properties - An object with any properties that will be added and accessible on the resource.
	 */
	constructor(properties: any = {}) {
		this.potion = potionInstance(this.constructor as typeof Item);
		Object.assign(this, properties);
	}

	get uri(): string {
		return this.$uri;
	}
	get id(): number | string | null {
		return this.$id;
	}

	equals(resource: any): boolean {
		if (resource instanceof Item) {
			return this.id === resource.id && this.constructor.name === resource.constructor.name;
		}
		return false;
	}

	toJSON(): any {
		const properties = {};

		Object.keys(this)
			.filter((key) => !key.startsWith('$') && key !== 'potion' && !isReadonly(this.constructor, key))
			.forEach((key) => {
				properties[key] = this[key];
			});

		return properties;
	}

	save(): Promise<this> {
		if (this.uri || this.id) {
			return this.update(this.toJSON());
		}
		return this.potion.fetch(potionURI(this.constructor as typeof Item), {
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
		return this.potion.fetch(this.uri, {
			cache: true,
			method: 'PATCH',
			data
		});
	}

	destroy(): Promise<void> {
		const {uri} = this;
		const cache = this.potion.cache;
		return this.potion.fetch(uri, {method: 'DELETE'})
			.then(clearCache);
		function clearCache(): void {
			// Clear the item from cache if exists
			if (cache.get(uri)) {
				cache.remove(uri);
			}
		}
	}
}
