import * as angular from 'angular';
import {PotionOptions, RequestOptions, PotionBase} from './core';


export {readonly, Item,	Route} from './core';


const potion = angular.module('potion', []).provider('potion', function (): any {
	let options = {};

	this.config = (config: PotionOptions) => {
		if (config) {
			return Object.assign(options, config);
		} else {
			return options;
		}
	};

	this.$get = ['$cacheFactory', '$q', '$http', function ($cacheFactory: angular.ICacheFactoryService, $q: angular.IQService, $http: angular.IHttpService): any {
		let cache = $cacheFactory.get('potion') || $cacheFactory('potion');

		class Potion extends PotionBase {
			// noinspection TypeScriptUnresolvedVariable
			static promise: any = $q;

			protected request(url: string, {method = 'GET', search, data, cache = true}: RequestOptions = {}): Promise<any> {
				return $http(Object.assign({url, method, data, cache}, {params: search}))
					.then(({headers, data}) => ({headers: headers(), data})) as any;
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
});


export {potion};
