import {isReadonly} from './metadata';
import {QueryOptions, Store} from './store';
import {FetchOptions} from './potion';
import {Pagination} from './pagination';


export interface ItemConstructor {
	new (object: any): Item;
	store?: Store<Item>;
}

export interface ItemOptions {
	'readonly'?: string[];
}


/**
 * Base resource class for API resources.
 * Extending this class will make all resource operations available on the child class.
 * Note that this is an abstract class and cannot be directly initiated.
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
	static store: Store<any>;

	/**
	 * Get a resource by id.
	 * @param {Number|String} id
	 * @param {FetchOptions} fetchOptions - Setting {cache: true} will ensure that the item will be fetched from cache if it exists and the HTTP request is cached.
	 */
	static fetch(id: number, fetchOptions?: FetchOptions): Promise<Item> {
		return this.store.fetch(id, fetchOptions);
	}

	/**
	 * Query resources.
	 * @param {QueryOptions} queryOptions - Can be used to manipulate the pagination with {page: number, perPage: number},
	 * but it can also be used to further filter the results with {sort: any, where: any}.
	 * @param {FetchOptions} fetchOptions - Setting {paginate: true} will result in the return value to be a Pagination object.
	 * Caching it this case will only apply for the HTTP request.
	 */
	static query(queryOptions?: QueryOptions | null, fetchOptions?: FetchOptions): Promise<Item[] | Pagination<Item>> {
		return this.store.query(queryOptions, fetchOptions);
	}

	/**
	 * Get the first item.
	 */
	static first(queryOptions?: QueryOptions): Promise<Item> {
		return this.store
			.query(queryOptions)
			.then((items) => items[0]);
	}

	private $uri: string;
	private $id: number | null = null;

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
	get id(): number | null {
		return this.$id;
	}

	save(): Promise<Item> {
		return (this.constructor as typeof Item).store.save(this.toJSON());
	}

	/**
	 * Update the resource.
	 * @param {Object} properties - An object with any properties to update.
	 */
	update(properties: any = {}): Promise<Item> {
		return (this.constructor as typeof Item).store.update(this, properties);
	}

	destroy(): Promise<Item> {
		return (this.constructor as typeof Item).store.destroy(this);
	}

	toJSON(): any {
		let properties = {};

		Object.keys(this)
			.filter((key) => !key.startsWith('$') && !isReadonly(this.constructor, key))
			.forEach((key) => {
				properties[key] = this[key];
			});

		return properties;
	}
}
