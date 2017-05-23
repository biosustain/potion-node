// tslint:disable: max-classes-per-file no-empty

import {Item} from './item';
import {
	entries, getErrorMessage,
	getPotionURI,
	hasTypeAndId,
	isAPotionItem,
	isDate,
	isFunction,
	isJsObject,
	isObjectEmpty,
	mapToObject,
	MemCache,
	merge,
	omap,
	parsePotionID,
	removeStrFromURI,
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

	describe('mapToObject()', () => {
		it('should convert a Map to Object', () => {
			const map = new Map();
			map.set('ping', 'pong');
			expect(mapToObject(map)).toEqual({ping: 'pong'});
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

	describe('isDate()', () => {
		it('should check if a value is a Date', () => {
			expect(isDate(true)).toBeFalsy();
			expect(isDate('')).toBeFalsy();
			expect(isDate(1)).toBeFalsy();
			expect(isDate(null)).toBeFalsy();
			expect(isDate(undefined)).toBeFalsy();
			expect(isDate([])).toBeFalsy();
			expect(isDate({})).toBeFalsy();
			expect(isDate(new noop())).toBeFalsy();
			expect(isDate(new Date())).toBeTruthy();
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

	describe('isAPotionItem()', () => {
		it('should check if a value is a Function', () => {
			expect(isAPotionItem(true)).toBeFalsy();
			expect(isAPotionItem('')).toBeFalsy();
			expect(isAPotionItem(1)).toBeFalsy();
			expect(isAPotionItem(null)).toBeFalsy();
			expect(isAPotionItem(undefined)).toBeFalsy();
			expect(isAPotionItem([])).toBeFalsy();
			expect(isAPotionItem({})).toBeFalsy();
			expect(isAPotionItem(new Date())).toBeFalsy();
			expect(isAPotionItem(() => {})).toBeFalsy();
			expect(isAPotionItem(noop)).toBeFalsy();
			expect(isAPotionItem(new noop())).toBeFalsy();
			expect(isAPotionItem(new Foo())).toBeTruthy();
		});
	});

	describe('omap()', () => {
		it('should recursively map an object keys/values to provided transformation fns', () => {
			const obj1 = {ping: true};
			const obj2 = {
				ping: {
					value: {
						pong: true
					}
				}
			};
			const arr = [obj1, obj2];

			const obj1Map = omap(obj1, keyToUpperCase, not);
			expect(obj1Map).toEqual({PING: false});

			const obj2Map = omap(obj2, keyToUpperCase, not);
			expect(obj2Map).toEqual({
				PING: {
					VALUE: {
						PONG: false
					}
				}
			});

			expect(omap(arr, keyToUpperCase, not)).toEqual([
				{PING: false},
				{
					PING: {
						VALUE: {
							PONG: false
						}
					}
				}
			]);
		});

		it('should not traverse Date objects', () => {
			const now = new Date();
			expect(omap({ping: now}, keyToUpperCase)).toEqual({PING: now});
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

	describe('removeStrFromURI()', () => {
		it('should remove some string from another string', () => {
			expect(removeStrFromURI('/foo/1', '')).toEqual('/foo/1');
			expect(removeStrFromURI('/prefix/foo/1', '/prefix')).toEqual('/foo/1');
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

	describe('entries()', () => {
		it('should return an array of [key, value] pairs for a Map or {}', () => {
			const map = new Map();
			map.set('ping', 'pong');
			expect(entries(map)).toEqual([['ping', 'pong']]);

			expect(entries({ping: true})).toEqual([['ping', true]]);
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
