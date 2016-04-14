import {Item} from './angular';


describe('potion/angular', () => {
	let $cacheFactory;
	let $q;
	let $httpBackend;
	let $http;
	let provider;

	// Make sure tslint does not complain about the var names
	/* tslint:disable: variable-name */
	let Ping;
	let User;
	/* tslint:enable: variable-name */

	beforeEach((<angular.IMockStatic>angular.mock).module('test', ['potionProvider', (potionProvider) => {
		provider = potionProvider;
	}]));

	beforeEach((<angular.IMockStatic>angular.mock).inject(function ($injector) {
		$cacheFactory = $injector.get('$cacheFactory');
		$q = $injector.get('$q');
		$httpBackend = $injector.get('$httpBackend');
		$http = $injector.get('$http');

		Ping = $injector.get('Ping');
		User = $injector.get('User');
	}));

	afterEach(() => {
		$httpBackend.verifyNoOutstandingRequest();
	});

	describe('potionProvider', () => {
		it('should provide a Potion instance', () => {
			expect(provider.$get($cacheFactory, $q, $http)).not.toBeUndefined();
		});

		describe('.config()', () => {
			it('should configure Potion({prefix, cache}) properties', () => {
				let config = {prefix: '/api'};
				provider.config(config);
				expect(provider.config()).toEqual(config);
				expect(provider.$get($cacheFactory, $q, $http).prefix).toEqual('/api');
			});
		});
	});

	describe('Item.fetch()', () => {
		it('should make a XHR request', (done) => {
			$httpBackend.expect('GET', '/ping/1').respond(200, {pong: true});

			Ping.fetch(1).then(() => {
				done();
			});

			$httpBackend.flush();
		});

		it('should use $cacheFactory by default to cache an Item', (done) => {
			let cache = $cacheFactory.get('potion');

			$httpBackend.expect('GET', '/user/1').respond(() => [200, {$uri: '/user/1'}]); // A fn will always return the updated object
			expect(cache).not.toBeUndefined();

			User.fetch(1).then(() => {
				expect(cache.get('/user/1')).not.toBeUndefined();
				done();
			});

			$httpBackend.flush();
		});

		// TODO: this should actually check if the http cache for $http was skipped, not the item cache (we already test of the item cache)
		it('should skip caching if {cache} option is set to false', (done) => {
			let cache = $cacheFactory.get('potion');

			$httpBackend.expect('GET', '/user/4').respond(() => [200, {}]);
			expect(cache).not.toBeUndefined();

			User.fetch(4, {cache: false}).then(() => {
				expect(cache.get('/user/4')).toBeUndefined();
				done();
			});

			$httpBackend.flush();
		});
	});
});


// Resources
class Ping extends Item {}
class User extends Item {
	name: string;
}

// Configure Potion,
// and register resources
angular
	.module('test', ['potion'])
	.config(['potionProvider', (potionProvider) => {
		potionProvider.config({prefix: ''});
	}])
	.factory('Ping', ['potion', (potion) => {
		potion.register('/ping', Ping);
		return Ping;
	}])
	.factory('User', ['potion', (potion) => {
		potion.register('/user', User);
		return User;
	}]);
