import {
	PotionOptions,
	PotionRequestOptions,
	PotionBase
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
			itemCache: cache
		}, options));
	}];

	return this;
});
