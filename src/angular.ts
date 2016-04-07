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
	let options = {prefix: '/api'};

	this.config = (config: PotionOptions) => {
		return Object.assign(options, config);
	};

	this.$get = ['$cacheFactory', '$q', '$http', function ($cacheFactory, $q, $http) {
		class Potion extends PotionBase {
			protected static promise = $q;

			fetch(url, options?: PotionRequestOptions): Promise<any> {
				let {method, data} = options || {method: 'GET', data: null};
				let config: any = {method, url, data};

				return $http(config).then((json) => json.data);
			}
		}

		// Use the $cacheFactory.
		// Allow user to override cache.

		/* tslint:disable: align */
		return Potion.create(Object.assign({
			itemCache: $cacheFactory('potion')
		}, options));
	}];

	return this;
});
