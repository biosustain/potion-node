// tslint:disable: max-classes-per-file no-empty

import {Item} from './item';
import {
	addPrefixToURI,
	fromSchemaJSON,
	getErrorMessage,
	getPotionURI,
	hasTypeAndId,
	isFunction,
	isJsObject,
	isObjectEmpty,
	MemCache,
	merge,
	omap,
	parsePotionID,
	removePrefixFromURI,
	toCamelCase,
	toPotionJSON,
	toSnakeCase
} from './utils';


class Bar extends Item {}
class Foo extends Item {
	createdAt?: Date;
	bar?: Bar;
}


describe('potion/utils', () => {
	describe('toSnakeCase()', () => {
		it('should convert camel case strings to snake case', () => {
			expect(toSnakeCase('camelCase')).toEqual('camel_case');
			expect(toSnakeCase('camelCase2')).toEqual('camel_case_2');
			expect(toSnakeCase('camel2')).toEqual('camel_2');
			expect(toSnakeCase('camelCASE')).toEqual('camel_case');
		});
	});

	describe('toCamelCase()', () => {
		it('should snake case strings to camel case', () => {
			expect(toCamelCase('snake_case')).toEqual('snakeCase');
			expect(toCamelCase('snake_case_2')).toEqual('snakeCase2');
			expect(toCamelCase('2_snake_case')).toEqual('2SnakeCase');
		});
	});

	describe('isJsObject()', () => {
		it('should check if a value is {}', () => {
			expect(isJsObject(true)).toBeFalsy();
			expect(isJsObject('')).toBeFalsy();
			expect(isJsObject(1)).toBeFalsy();
			expect(isJsObject(null)).toBeFalsy();
			expect(isJsObject(undefined)).toBeFalsy();
			expect(isJsObject([])).toBeFalsy();
			expect(isJsObject({})).toBeTruthy();
			expect(isJsObject(new Date())).toBeTruthy();
		});
	});

	describe('isFunction()', () => {
		it('should check if a value is a Function', () => {
			expect(isFunction(true)).toBeFalsy();
			expect(isFunction('')).toBeFalsy();
			expect(isFunction(1)).toBeFalsy();
			expect(isFunction(null)).toBeFalsy();
			expect(isFunction(undefined)).toBeFalsy();
			expect(isFunction([])).toBeFalsy();
			expect(isFunction({})).toBeFalsy();
			expect(isFunction(new Date())).toBeFalsy();
			expect(isFunction(() => {})).toBeTruthy();
			expect(isFunction(noop)).toBeTruthy();
		});
	});

	describe('fromSchemaJSON()', () => {
		it('should convert a schema JSON to a JS object', () => {
			const schema = {
				$schema: 'http://json-schema.org/draft-04/hyper-schema#',
				properties: {
					created_at: {
						additionalProperties: false,
						default: 'Fri, 23 Sep 2016 14:47:34 GMT',
						properties: {
							$date: {
								type: 'integer'
							}
						},
						type: 'object'
					}
				},
				type: 'object'
			};

			expect(fromSchemaJSON(schema)).toEqual({
				$schema: 'http://json-schema.org/draft-04/hyper-schema#',
				properties: {
					createdAt: {
						additionalProperties: false,
						default: 'Fri, 23 Sep 2016 14:47:34 GMT',
						properties: {
							$date: {
								type: 'integer'
							}
						},
						type: 'object'
					}
				},
				type: 'object'
			});
		});
	});

	describe('omap()', () => {
		it('should map an object\'s keys/values to provided transformation fns', () => {
			const obj1Map = omap({ping: true}, keyToUpperCase, not);
			expect(obj1Map).toEqual({PING: false});
		});

		it('should still work without a value map fn', () => {
			const obj1Map = omap({ping: true}, keyToUpperCase);
			expect(obj1Map).toEqual({PING: true});
		});
	});

	describe('getErrorMessage()', () => {
		it('should aggregate an error message', () => {
			expect(getErrorMessage(new Error('Oops.'))).toEqual('Oops.');
			expect(getErrorMessage('Oops.')).toEqual('Oops.');
			expect(getErrorMessage(null)).toEqual('An error occurred while Potion tried to retrieve a resource.');
			expect(getErrorMessage(null, '/foo/1')).toEqual('An error occurred while Potion tried to retrieve a resource from \'/foo/1\'.');
		});
	});

	describe('toPotionJSON()', () => {
		it('should serialize an Object to Potion JSON', () => {
			const foo = new Foo({createdAt: new Date()});
			const bar = new Bar();
			Object.assign(bar, {
				$uri: '/bar/1',
				$id: 1
			});

			Object.assign(foo, {
				bar,
				$uri: '/foo/1',
				$id: 1
			});

			const json = toPotionJSON(foo);
			expect(json).toEqual({$ref: '/foo/1'});
		});

		it('should serialize nested objects to Potion JSON', () => {
			const now = new Date();
			const foo = new Foo();
			Object.assign(foo, {
				$uri: '/foo/1',
				$id: 1
			});

			const obj = {
				timestamp: now,
				foo
			};

			const json = toPotionJSON(obj);
			expect(json).toEqual({
				timestamp: {$date: now.getTime()},
				foo: {$ref: '/foo/1'}
			});
		});

		it('should only append a prefix to $ref if $uri does not already contain it', () => {
			const foo = new Foo();
			Object.assign(foo, {
				$uri: '/prefix/foo/1',
				$id: 1
			});

			const json = toPotionJSON(foo, '/prefix');
			expect(json).toEqual({$ref: '/prefix/foo/1'});
		});
	});

	describe('parsePotionID()', () => {
		it('should properly parse a Potion ID', () => {
			expect(parsePotionID(1)).toEqual(1);
			expect(parsePotionID('1')).toEqual(1);
			const uuid = '00cc8d4b-9682-4655-ad78-1fa4b03e757d';
			expect(parsePotionID(uuid)).toEqual(uuid);
			expect(parsePotionID({})).toBeNull();
		});
	});

	describe('hasTypeAndId()', () => {
		it('should check if the JSON contains the necessary information for aggregating a Potion URI', () => {
			expect(hasTypeAndId({})).toBeFalsy();
			expect(hasTypeAndId({$type: 'foo'})).toBeFalsy();
			expect(hasTypeAndId({$type: 1, $id: 1})).toBeFalsy();
			expect(hasTypeAndId({$type: 'foo', $id: 1})).toBeTruthy();
			expect(hasTypeAndId({$type: 'foo', $id: '1'})).toBeTruthy();
		});
	});

	describe('getPotionURI()', () => {
		it('should aggregate a Potion URI from a Potion JSON object', () => {
			expect(getPotionURI({})).toEqual('');
			expect(getPotionURI({$uri: '/foo/1'})).toEqual('/foo/1');
			expect(getPotionURI({$ref: '/foo/1'})).toEqual('/foo/1');
			expect(getPotionURI({$type: 'foo', $id: 1})).toEqual('/foo/1');
			expect(getPotionURI({$type: 'foo', $id: '1'})).toEqual('/foo/1');
		});
	});

	describe('addPrefixToURI()', () => {
		it('should add a prefix to a string (if it does not already contain it)', () => {
			expect(addPrefixToURI('/foo/1', '/prefix')).toEqual('/prefix/foo/1');
			expect(addPrefixToURI('/prefix/foo/1', '/prefix')).toEqual('/prefix/foo/1');
		});
	});

	describe('removePrefixFromURI()', () => {
		it('should remove some string from another string', () => {
			expect(removePrefixFromURI('/foo/1', '')).toEqual('/foo/1');
			expect(removePrefixFromURI('/prefix/foo/1', '/prefix')).toEqual('/foo/1');
		});
	});

	describe('merge()', () => {
		it('should merge a bunch of objects into one', () => {
			expect(merge({ping: true}, {pong: false})).toEqual({ping: true, pong: false});
		});
	});

	describe('isObjectEmpty()', () => {
		it('should check whether an object is empty or not', () => {
			expect(isObjectEmpty({ping: true})).toBeFalsy();
			expect(isObjectEmpty({})).toBeTruthy();
		});
	});

	describe('MemCache()', () => {
		const cache = new MemCache();
		const foo = new Foo();


		describe('.has()', () => {
			it('should check if the cache has a key or not set', () => {
				expect(cache.has('ping')).toBeFalsy();
			});
		});

		describe('.put()', () => {
			it('should set a value for a key', () => {
				cache.put('ping', Promise.resolve(foo));
				expect(cache.has('ping')).toBeTruthy();
			});
			it('should return the value for the key', () => {
				const value = cache.put('ping', Promise.resolve(foo));
				expect(value).toBeDefined();
			});
		});

		describe('.get()', () => {
			it('should retrieve the value for a key', done => {
				const value = cache.get('ping');
				expect(value).toBeDefined();
				expect(value instanceof Promise).toBeTruthy();

				value.then(item => {
					expect(item instanceof Foo).toBeTruthy();
					expect(item.equals(foo)).toBeTruthy();
					done();
				});
			});
		});

		describe('.remove()', () => {
			it('should remove the value for a key', () => {
				cache.remove('ping');
				expect(cache.has('ping')).toBeFalsy();
			});
		});
	});
});


function keyToUpperCase(key: string): string {
	return key.toUpperCase();
}
function not(value: any): any {
	return !value;
}
function noop() {}
