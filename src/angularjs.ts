import angular from 'angular';
import {
	PotionOptions,
	PotionRequestOptions,
	PotionBase,
	PotionCache
} from './base';


export {
	PotionCache,
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

		class CacheFactory implements PotionCache {
			get(id: string) {
				return cache.get(id);
			}

			set(id, item) {
				return cache.put(id, item);
			}

			clear(id: string) {
				cache.remove(id);
			}
		}

		class Potion extends PotionBase {
			Promise = $q;

			fetch(url, options?: PotionRequestOptions): Promise<any> {
				const {method, data} = options || {method: 'GET'};
				const config: any = {method, url, data};

				return $http(config).then((json) => json.data);
			}
		}

		// Use the $cacheFactory.
		// Allow user to override cache.
		return Potion.create(Object.assign({
			cache: new CacheFactory()
		}, options));
	}]
});
