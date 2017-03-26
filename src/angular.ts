import * as angular from 'angular';
import {
	PotionOptions,
	RequestOptions,
	PotionResponse,
	PotionBase
} from './core';
import {setPotionPromise} from './core/metadata';


export {Item, Route, readonly} from './core';


const potion = angular.module('potion', [])
	.provider('potion', potionProvider);


function potionProvider(): any {
	const options = {};

	this.config = (config: PotionOptions) => {
		if (config) {
			return Object.assign(options, config);
		} else {
			return options;
		}
	};

	this.$get = ['$cacheFactory', '$q', '$http', ($cacheFactory: angular.ICacheFactoryService, $q: angular.IQService, $http: angular.IHttpService): any => {
		let cache = $cacheFactory.get('potion') || $cacheFactory('potion');

		class Potion extends PotionBase {
			protected request(url: string, {method = 'GET', search, data, cache = true}: RequestOptions = {}): Promise<PotionResponse> {
				return $http(Object.assign({url, method, data, cache}, {params: search}))
					.then(({headers, data}) => {
						const response: any = {data};
						if (headers) {
							response.headers = headers();
						}
						return response;
					}) as any;
			}
		}

		// Make sure Potion uses $q as the Promise implementation.
		// NOTE: This is necessary due to the nature of AngularJS change detection system.
		setPotionPromise(Potion, $q);

		// Use the $cacheFactory and allow user to override cache.
		/* tslint:disable: align */
		return new Potion(Object.assign({
			cache
		}, options));
	}];

	return this;
}


export {potion};
