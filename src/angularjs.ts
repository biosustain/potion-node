import angular from 'angular';
import {toCamelCase, pairsToObject} from './utils';
import {
	PotionOptions,
	PotionFetchOptions,
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
			fetch(url, options?: PotionFetchOptions): Promise<any> {
				const {method, data} = options || {method: 'GET'};
				const config: any = {method, url, data};

				return $http(config).then((json) => json.data);
			}

			fromPotionJSON(json: any): Promise<any> {
				if (typeof json === 'object' && json !== null) {
					if (json instanceof Array) {
						return $q.all(json.map((item) => this.fromPotionJSON(item)));
					} else if (typeof json.$uri === 'string') {
						const {resource, uri} = this.parseURI(json.$uri);
						const promises = [];

						for (const key of Object.keys(json)) {
							if (key === '$uri') {
								promises.push($q.resolve([key, uri]));
								// } else if (constructor.deferredProperties && constructor.deferredProperties.includes(key)) {
								// 	converted[toCamelCase(key)] = () => this.fromJSON(value[key]);
							} else {
								promises.push(this.fromPotionJSON(json[key]).then((value) => {
									return [toCamelCase(key), value];
								}));
							}
						}

						return $q.all(promises).then((propertyValuePairs) => {
							const properties: any = pairsToObject(propertyValuePairs); // `propertyValuePairs` is a collection of [key, value] pairs
							const obj = {};

							Object
								.keys(properties)
								.filter((key) => key !== '$uri')
								.forEach((key) => obj[key] = properties[key]);

							Object.assign(obj, {uri: properties.$uri});

							// TODO: move this logic somewhere else
							let instance = Reflect.construct(<any>resource, [obj]);
							if (this.cache && this.cache.set) {
								this.cache.set(uri, <any>instance);
							}

							return instance;
						});
					} else if (Object.keys(json).length === 1) {
						if (typeof json.$ref === 'string') {
							let {uri} = this.parseURI(json.$ref);
							return this.get(uri);
						} else if (typeof json.$date !== 'undefined') {
							return $q.resolve(new Date(json.$date));
						}
					}

					const promises = [];

					for (const key of Object.keys(json)) {
						promises.push(this.fromPotionJSON(json[key]).then((value) => {
							return [toCamelCase(key), value];
						}));
					}

					return $q.all(promises).then((propertyValuePairs) => {
						return pairsToObject(propertyValuePairs);
					});
				} else {
					return $q.resolve(json);
				}
			}
		}

		// Use the $cacheFactory.
		// Allow user to override cache.
		return Potion.create(Object.assign({
			cache: new CacheFactory()
		}, options));
	}]
});
