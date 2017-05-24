// tslint:disable: max-classes-per-file
import * as angular from 'angular';
import {
	PotionBase,
	PotionOptions,
	PotionResponse,
	RequestOptions
} from './core';
import {setPotionPromise} from './core/metadata';
import {ItemCache} from './core/potion';
import {Item} from './core/item';


export {Item, Route, readonly} from './core';


const potion = angular.module('potion', [])
	.provider('potion', potionProvider);


function potionProvider(): any {
	const options = {};

	// tslint:disable-next-line: no-invalid-this
	this.config = (config: PotionOptions) => {
		if (config) {
			return Object.assign(options, config);
		} else {
			return options;
		}
	};

	// tslint:disable-next-line: no-invalid-this
	this.$get = ['$cacheFactory', '$q', '$http', ($cacheFactory: angular.ICacheFactoryService, $q: angular.IQService, $http: angular.IHttpService): any => {
		const cache = $cacheFactory.get('potion') || $cacheFactory('potion');

		class Potion extends PotionBase {
			// tslint:disable-next-line: prefer-function-over-method
			protected request(url: string, {method = 'GET', search, data, cache = true}: RequestOptions = {}): Promise<PotionResponse> {
				return $http({url, method, data, cache, params: search})
					.then(({headers, data}) => {
						const response: any = {data};
						if (headers) {
							response.headers = headers();
						}
						return response;
					}) as any;
			}
		}

		class AngularJsCache<T extends Item> implements ItemCache<T> {
			has(key: string): boolean {
				return cache.get(key) !== undefined;
			}
			get(key: string): Promise<T> {
				return cache.get<Promise<T>>(key);
			}
			put(key: string, item: Promise<T>): Promise<T> {
				cache.put(key, item);
				return cache.get<Promise<T>>(key);
			}

			remove(key: string): void {
				cache.remove(key);
			}
		}

		// Make sure Potion uses $q as the Promise implementation.
		// NOTE: This is necessary due to the nature of AngularJS change detection system.
		setPotionPromise(Potion, $q);

		// Use the $cacheFactory and allow user to override cache.
		/* tslint:disable: align */
		return new Potion({
			cache: new AngularJsCache(),
			...options
		});
	}];

	// tslint:disable-next-line: no-invalid-this
	return this;
}


export {potion};
