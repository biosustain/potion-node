import {
	PotionOptions,
	PotionRequestOptions,
	PotionBase,
	PotionItemCache
} from './base';


export {
	PotionItemCache,
	Item,
	Route
} from './base';

export default angular.module('potion', []).provider('potion', function () {
	const options = {prefix: '/api'};

	this.config = (config: PotionOptions) => {
		return Object.assign(options, config);
	};

	this.$get = ['$cacheFactory', '$q', '$http', function ($cacheFactory, $q, $http) {
		const cache = $cacheFactory.get('potion') || $cacheFactory('potion');

		class ItemCache implements PotionItemCache<any> {
			get(id: string) {
				return cache.get(id);
			}

			put(id, item) {
				return cache.put(id, item);
			}

			clear(id: string) {
				cache.remove(id);
			}
		}

		class Potion extends PotionBase {
			promise = $q;

			fetch(url, options?: PotionRequestOptions): Promise<any> {
				const {method, data} = options || {method: 'GET', data: null};
				const config: any = {method, url, data};

				return $http(config).then((json) => json.data);
			}
		}

		// Use the $cacheFactory.
		// Allow user to override cache.

		/* tslint:disable: align */
		return Potion.create(Object.assign({
			itemCache: new ItemCache()
		}, options));
	}];

	return this;
});
