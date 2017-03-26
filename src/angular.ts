import * as angular from 'angular';
import {
	PotionOptions,
	RequestOptions,
	PotionResponse,
	PotionBase
} from './core';


export {readonly, Item,	Route} from './core';


const potion = angular.module('potion', [])
	.provider('potion', potionProvider);


function potionProvider(): any {
	let options = {};

	this.config = (config: PotionOptions) => {
		if (config) {
			return Object.assign(options, config);
		} else {
			return options;
		}
	};

	this.$get = ['$cacheFactory', '$http', ($cacheFactory: angular.ICacheFactoryService, $http: angular.IHttpService): any => {
		let cache = $cacheFactory.get('potion') || $cacheFactory('potion');

		class Potion extends PotionBase {
			protected request(url: string, {method = 'GET', search, data, cache = true}: RequestOptions = {}): Promise<PotionResponse> {
				return $http(Object.assign({url, method, data, cache}, {params: search}))
					.then(({headers, data}) => {
						const res: any = {data};

						if (headers) {
							res.headers = headers();
						}

						return res;
					}) as any;
			}
		}

		// Use the $cacheFactory.
		// Allow user to override cache.
		/* tslint:disable: align */
		return new Potion(Object.assign({
			cache
		}, options));
	}];

	return this;
}


export {potion};
