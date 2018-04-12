import {FetchOptions, PotionBase} from './potion';
import {Item} from './item';


/**
 * Array like class with resources.
 * The class is returned when the {paginate} option is set to `true` when a query is made.
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
export class Pagination<T extends Item> implements Iterable<T> {
    static get [Symbol.species]() {
        return Pagination;
    }

    get page(): number {
        return this.$page;
    }
    // Setting the page will trigger a new query and update the items.
    set page(page: number) {
        this.changePageTo(page);
    }

    get perPage(): number {
        return this.$perPage;
    }

    get pages(): number {
        return Math.ceil(this.$total / this.$perPage);
    }

    get total(): number {
        return this.$total;
    }

    get length(): number {
        return this.items.length;
    }

    private potion: PotionBase;
    private uri: string;

    private $page: number;
    private $perPage: number;
    private $total: number;

    constructor({potion, uri}: {potion: PotionBase, uri: string}, private items: T[], count: string, private options: FetchOptions) {
        this.potion = potion;
        this.uri = uri;

        // tslint:disable-next-line: no-magic-numbers
        const {page = 1, perPage = 25}: any = {...this.options.params};
        this.$page = page;
        this.$perPage = perPage;
        this.$total = parseInt(count, 10);
    }

    // https://basarat.gitbooks.io/typescript/docs/iterators.html
    [Symbol.iterator](): IterableIterator<T> {
        return this.items.values();
    }

    toArray(): T[] {
        return this.items.slice(0);
    }
    at(index: number): T {
        return this.items[index];
    }

    changePageTo(page: number): Promise<T | T[] | Pagination<T> | any> {
        const {pagination} = this.options;
        (this.options.params as any).page = page;
        this.$page = page;
        return this.potion.fetch(this.uri, this.options, {
            pagination
        });
    }

    update(items: T[], count: number): this {
        this.items.splice(0, this.items.length, ...items);

        this.$total = count;
        return this;
    }
}
