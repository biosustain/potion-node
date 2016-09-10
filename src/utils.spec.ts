import {toSnakeCase} from './utils';

describe('potion/utils', () => {
	describe('toSnakeCase()', () => {
		it('should convert camel case strings to snake case', () => {
			const simple = 'camelCase';
			expect(toSnakeCase(simple)).toEqual('camel_case');
			const withNumbers = 'camelCase2';
			expect(toSnakeCase(withNumbers)).toEqual('camel_case_2');
			const numbers = 'camel2';
			expect(toSnakeCase(numbers)).toEqual('camel_2');
			const caps = 'camelCASE';
			expect(toSnakeCase(caps)).toEqual('camel_case');
		});
	});
});
