import {PotionBase, FetchOptions} from './potion';
import {Item} from './item';


export interface PaginationOptions {
	page?: number;
	perPage?: number;
}


/**
 * Array like class with resources.
 * The class is returned when the {paginate} option is set to `true` when a query is made.
 * It implements the [Iterator](https://basarat.gitbooks.io/typescript/content/docs/iterators.html) which means that `for..of` and `.next()` can be used to iterate over the items.
 *
 * @example
 * class User extends Item {}
 *
 * User.query(null, {paginate: true}).then((users) => {
 *     for (let user of users) {
 *         console.log(user);
 *     }
 * });
 */
export class Pagination<T extends Item> {
	private potion: PotionBase;
	private uri: string;
	private options: FetchOptions;

	private items: T[] = [];

	private _page: number;
	private _perPage: number;
	private _total: number;

	constructor({potion, uri}: {potion: PotionBase, uri: string}, items: T[], count: string, options?: FetchOptions) {
		this.potion = potion;
		this.uri = uri;
		this.options = options || ({} as FetchOptions);

		this.items.push(...items);

		// tslint:disable-next-line:no-magic-numbers
		const {page = 1, perPage = 25} = this.options.search || {};
		this._page = page;
		this._perPage = perPage;
		this._total = parseInt(count, 10);
	}

	[Symbol.iterator](): IterableIterator<T> {
		return this.items.values();
	}

	get page(): number {
		return this._page;
	}
	// Setting the page will trigger a new query and update the items.
	set page(page: number) {
		this.changePageTo(page);
	}

	get perPage(): number {
		return this._perPage;
	}

	get pages(): number {
		return Math.ceil(this._total / this._perPage);
	}

	get total(): number {
		return this._total;
	}

	get length(): number {
		return this.items.length;
	}

	changePageTo(page: number): Promise<T | T[] | Pagination<T> | any> {
		(this.options.search as any).page = page;
		this._page = page;
		return this.potion.fetch(this.uri, this.options, this);
	}

	update(items: T[], count: number): this {
		this.items.splice(0, this.length, ...items);
		this._total = count;
		return this;
	}

	toArray(): T[] {
		return this.items;
	}
}
