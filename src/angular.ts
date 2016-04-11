import {
	PotionOptions,
	PotionRequestOptions,
	PotionBase
} from './base';


export {
	PotionItemCache,
	Item,
	Route,
	Pagination
} from './base';

export default angular.module('potion', []).provider('potion', function () {
	let options = {prefix: '/api'};

	this.config = (config: PotionOptions) => {
		return Object.assign(options, config);
	};

	this.$get = ['$cacheFactory', '$q', '$http', function ($cacheFactory, $q, $http) {
		class Potion extends PotionBase {
			static promise = $q;

			request(url, options?: PotionRequestOptions): Promise<any> {
				return $http(Object.assign({url, method: 'GET', cache: true}, options)).then(({data, headers}) => {
					return {data, headers: headers()};
				});
			}
		}

		// Use the $cacheFactory.
		// Allow user to override cache.

		/* tslint:disable: align */
		return new Potion(Object.assign({
			cache: $cacheFactory('potion')
		}, options));
	}];

	return this;
});
