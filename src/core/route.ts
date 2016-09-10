import {potionInstance, potionURI} from './metadata';
import {RequestOptions, FetchOptions} from './potion';


export type RouteType<T> = (params?: any, options?: FetchOptions) => Promise<T>;


export function route<T>(path: string, {method}: RequestOptions = {}): RouteType<T> {
	// tslint:disable-next-line:only-arrow-functions
	return function (params?: any, {paginate = false, cache = true}: FetchOptions = {}): Promise<T> {
		let isCtor = typeof this === 'function';
		let uri = `${isCtor ? potionURI(this) : this.uri}${path}`;

		let options: FetchOptions = {method, paginate, cache};
		if (method === 'GET') {
			options.search = params;
		} else if ((['POST', 'PUT', 'PATCH'] as any).includes(method)) {
			options.data = params;
		}

		return potionInstance(isCtor ? this : this.constructor)
			.fetch(uri, options);
	};
}

/**
 * Use the Route object methods to register other REST methods on a resource.
 *
 * @example
 * class User extends Item {
 *     static readSiblings = Route.GET('/siblings');
 *     createSibling = Route.POST('/sibling');
 * }
 */
// tslint:disable-next-line:variable-name
export const Route = {
	GET<T>(uri: string): RouteType<T> {
		return route<T>(uri, {
			method: 'GET'
		});
	},
	DELETE<T>(uri: string): RouteType<T> {
		return route<T>(uri, {
			method: 'DELETE'
		});
	},
	POST<T>(uri: string): RouteType<T> {
		return route<T>(uri, {
			method: 'POST'
		});
	},
	PATCH<T>(uri: string): RouteType<T> {
		return route<T>(uri, {
			method: 'PATCH'
		});
	},
	PUT<T>(uri: string): RouteType<T> {
		return route<T>(uri, {
			method: 'PUT'
		});
	}
};
