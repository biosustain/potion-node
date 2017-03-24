import {potionInstance, potionURI} from './metadata';
import {FetchOptions, ItemCache, PotionBase} from './potion';
import {ItemConstructor, Item} from './item';
import {PaginationOptions, Pagination} from './pagination';


export interface QueryOptions extends PaginationOptions {
	where?: any;
	sort?: any;
}


export class Store<T extends Item> {
	readonly cache: ItemCache<Item>;
	private itemConstructor: ItemConstructor;

	constructor(itemConstructor: ItemConstructor) {
		this.itemConstructor = itemConstructor;

		const potion: PotionBase = potionInstance(itemConstructor);
		this.cache = potion.cache;

	}

	fetch(id: number|string, {cache = true}: FetchOptions = {}): Promise<T> {
		return potionInstance(this.itemConstructor).fetch(`${potionURI(this.itemConstructor)}/${id}`, {
			method: 'GET',
			cache
		});
	}

	query(queryOptions?: QueryOptions | null, {paginate = false, cache = true}: FetchOptions = {}, paginationObj?: Pagination<T>): Promise<T[] | Pagination<T> | any> {
		return potionInstance(this.itemConstructor).fetch(
			potionURI(this.itemConstructor),
			{
				method: 'GET',
				search: queryOptions,
				paginate,
				cache
			},
			paginationObj
		);
	}

	update(item: Item, data: any = {}): Promise<T> {
		return potionInstance(this.itemConstructor).fetch(item.uri, {
			cache: true,
			method: 'PATCH',
			data
		});
	}

	save(data: any = {}): Promise<T> {
		return potionInstance(this.itemConstructor).fetch(potionURI(this.itemConstructor), {
			cache: true,
			method: 'POST',
			data
		});
	}

	destroy(item: Item): Promise<T> {
		const {uri} = item;

		return potionInstance(this.itemConstructor)
			.fetch(uri, {method: 'DELETE'})
			.then(() => {
				// Clear the item from cache if exists
				if (this.cache.get(uri)) {
					this.cache.remove(uri);
				}
			});
	}
}
