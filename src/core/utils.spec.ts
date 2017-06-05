// tslint:disable: max-classes-per-file no-empty

import {Item} from './item';
import {
	addPrefixToURI,
	findPotionResource,
	findRoots,
	fromSchemaJSON,
	getErrorMessage,
	getGlobal,
	getPotionID,
	getPotionURI,
	hasTypeAndId,
	isFunction,
	isJsObject,
	isObjectEmpty,
	isPotionURI,
	MemCache,
	merge,
	omap,
	parsePotionID,
	removePrefixFromURI,
	replaceSelfReferences,
	SelfReference,
	toCamelCase,
	toPotionJSON,
	toSelfReference,
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
			expect(isJsObject([])).toBeTruthy();
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

	describe('findRoots()', () => {
		it('should find {uri} objects', () => {
			const uri = '/ping/1';
			const json = {
				uri,
				ping: true,
				pong: false,
				self: new SelfReference(uri)
			};

			const roots = findRoots(json);

			expect(roots.get(uri)).toEqual(json);
			expect(roots.size).toEqual(2);
		});

		it('should always contain the first object', () => {
			const json = {
				ping: true,
				pong: {
					uri: '/pong/1',
					value: 1
				}
			};

			const roots = findRoots(json);
			const fist = roots.values()
				.next()
				.value;

			expect(roots.size).toEqual(2);
			expect(fist).toEqual(json);
		});

		it('should recursively find {uri} objects', () => {
			const foo1Uri = '/foo/1';
			const foo2Uri = '/foo/2';
			const bar1Uri = '/bar/1';
			const bar2Uri = '/bar/2';
			const json = [
				{
					uri: foo1Uri,
					bars: [{
						uri: bar1Uri,
						foo: new SelfReference(foo1Uri),
						sibling: {
							uri: bar2Uri,
							sibling: new SelfReference(bar1Uri)
						}
					}]
				},
				{
					uri: foo2Uri,
					bars: []
				}
			];

			const roots = findRoots(json);

			// NOTE: First item in roots is always the json itself.
			expect(roots.get(foo1Uri).uri).toEqual(foo1Uri);
			expect(roots.get(bar1Uri).uri).toEqual(bar1Uri);
			expect(roots.get(bar2Uri).uri).toEqual(bar2Uri);
			expect(roots.get(foo2Uri).uri).toEqual(foo2Uri);

			expect(roots.size).toEqual(5);
		});

		it('should not contain duplicates', () => {
			const uri = '/foo/1';
			const obj = {uri};
			const json = [obj, obj, {uri}, {uri}];
			const roots = findRoots(json);

			// NOTE: First item in roots is always the json itself.
			expect(roots.get(uri)).toEqual(obj);
			expect(roots.size).toEqual(2);
		});
	});

	describe('replaceSelfReferences()', () => {
		it('should return the original value if it\'s null or not an object', () => {
			const roots = new Map();
			expect(replaceSelfReferences(null, roots)).toEqual(null);
			expect(replaceSelfReferences('ping', roots)).toEqual('ping');
			expect(replaceSelfReferences(1, roots)).toEqual(1);
			expect(replaceSelfReferences(undefined, roots)).toEqual(undefined);
			expect(replaceSelfReferences(noop, roots)).toEqual(noop);
		});

		it('should replace self references in a object', () => {
			const uri = '/ping/1';
			const json = {
				uri,
				ping: true,
				pong: false,
				self: new SelfReference(uri)
			};
			replaceSelfReferences(json, findRoots(json));
			expect(json.self as any).toEqual(json);
		});

		it('should recursively replace self references in a object', () => {
			const fooUri = '/foo/1';
			const bar1Uri = '/bar/1';
			const bar2Uri = '/bar/2';
			const json = {
				uri: fooUri,
				bars: [{
					uri: bar1Uri,
					foo: new SelfReference(fooUri),
					sibling: {
						uri: bar2Uri,
						sibling: new SelfReference(bar1Uri)
					}
				}]
			};

			// Replace all refs
			replaceSelfReferences(json, findRoots(json));

			const bar = json.bars[0];
			const fooRef: any = bar.foo;
			const siblingRef: any = bar.sibling;

			expect(fooRef.uri).toEqual(json.uri);
			expect(Array.isArray(fooRef.bars)).toBeTruthy();
			expect(siblingRef.uri).toEqual(bar2Uri);
			expect(siblingRef.sibling.uri).toEqual(bar.uri);
		});

		it('should recursively replace self references in an array', () => {
			const foo1Uri = '/foo/1';
			const foo2Uri = '/foo/2';
			const bar1Uri = '/bar/1';
			const bar2Uri = '/bar/2';
			const json = [
				{
					uri: foo1Uri,
					bars: [{
						uri: bar1Uri,
						foo: new SelfReference(foo1Uri),
						sibling: {
							uri: bar2Uri,
							sibling: new SelfReference(bar1Uri)
						}
					}]
				},
				{
					uri: foo2Uri,
					sibling: new SelfReference(foo1Uri),
					bars: []
				}
			];

			// Replace all refs
			replaceSelfReferences(json, findRoots(json));

			const foo1 = json[0];
			const foo2: any = json[1];
			const foo1Bar = foo1.bars[0];
			const foo1Ref: any = foo1Bar.foo;
			const foo1BarSiblingRef: any = foo1Bar.sibling;
			const foo2SiblingRef = foo2.sibling;

			expect(foo1Ref.uri).toEqual(foo1.uri);
			expect(Array.isArray(foo1Ref.bars)).toBeTruthy();
			expect(foo1BarSiblingRef.uri).toEqual(bar2Uri);
			expect(foo1BarSiblingRef.sibling.uri).toEqual(foo1Bar.uri);
			expect(foo2SiblingRef.uri).toEqual(foo1.uri);
		});

		it('should work with cross references', () => {
			const person1Uri = '/person/1';
			const person2Uri = '/person/2';

			const group1Uri = '/group/1';
			const group2Uri = '/group/2';

			const people = [
				{
					uri: person1Uri,
					groups: [
						{
							uri: group1Uri,
							members: [new SelfReference(person1Uri), new SelfReference(person2Uri)]
						},
						{
							uri: group2Uri,
							members: [new SelfReference(person1Uri), new SelfReference(person2Uri)]
						}
					]
				},
				{
					uri: person2Uri,
					groups: [
						{
							uri: group1Uri,
							members: [new SelfReference(person1Uri), new SelfReference(person2Uri)]
						},
						{
							uri: group2Uri,
							members: [new SelfReference(person1Uri), new SelfReference(person2Uri)]
						}
					]
				}
			];

			// Replace all refs
			replaceSelfReferences(people, findRoots(people));

			for (const person of people) {
				expect(person.groups.length).toEqual(2);
				for (const group of person.groups) {
					const {uri}: any = {...group};
					expect(uri === group1Uri || uri === group2Uri).toBeTruthy();
					expect(group.members.length).toEqual(2);
					for (const member of group.members) {
						const {uri}: any = {...member};
						expect(uri === person1Uri || uri === person2Uri).toBeTruthy();
					}
				}
			}
		});
	});

	describe('toSelfReference()', () => {
		it('should convert a string to a SelfReference', () => {
			const json = {uri: '/foo/1'};
			const ref = toSelfReference(json.uri);

			expect(ref instanceof SelfReference).toBeTruthy();
			expect(ref.matches(json)).toBeTruthy();
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
			expect(parsePotionID('')).toBeNull();
		});
	});

	describe('getPotionID()', () => {
		it('should get a Potion ID from an URI', () => {
			expect(getPotionID('/foo/1', '/foo')).toEqual(1);
			expect(getPotionID('/prefix/foo/1', '/foo')).toEqual(1);
			const uuid = '00cc8d4b-9682-4655-ad78-1fa4b03e757d';
			expect(getPotionID(`/foo/${uuid}`, '/foo')).toEqual(uuid);
			expect(getPotionID('/foo', '/foo')).toBeNull();
		});
	});

	describe('findPotionResource()', () => {
		it('should return a Potion resource if found, otherwise undefined', () => {
			const resources = {'/foo': Foo};

			expect(findPotionResource('/foo', resources)).toBeUndefined();
			expect(findPotionResource('/bar', resources)).toBeUndefined();
			expect(findPotionResource('/foo/1', resources)).toEqual({
				resourceURI: '/foo',
				resource: Foo
			});
		});
	});

	describe('isPotionURI()', () => {
		it('should check if some string is a Potion URI', () => {
			const resources = {'/foo': Foo};

			expect(isPotionURI('/foo', resources)).toBeFalsy();
			expect(isPotionURI('/foo/1', resources)).toBeTruthy();
			expect(isPotionURI('/bar', resources)).toBeFalsy();
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

	describe('getGlobal()', () => {
		it('should retrieve the global object', () => {
			expect(typeof getGlobal()).toEqual('object');
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
