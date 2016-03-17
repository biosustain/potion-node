import {Potion} from './fetch';
import {Item, Route} from "./potion";

// Mock request responses using
// https://www.npmjs.com/package/fetch-mock
import fetchMock from 'fetch-mock';


describe('potion/fetch', () => {

	beforeEach(() => {
		fetchMock.mock('http://localhost/ping/1', {pong: 1});

		fetchMock.mock('http://localhost/animal/1', {
			name: 'Sloth'
		});
		fetchMock.mock('http://localhost/animal/1/proportions', {
			height: 2,
			weight: 2450
		});

		fetchMock.mock('http://localhost/animal/names', ['Sloth', 'Panda']);
	});

	afterEach(() => {
		fetchMock.restore();
	});

	it('Item.fetch() should make a XHR request', (done) => {
		Ping.fetch(1).subscribe(() => {
			expect(fetchMock.called('http://localhost/ping/1')).toBe(true);
			done();
		});
	});

	it('should fetch animal async', (done) => {

		Animal.fetch(1).subscribe((animal: Animal) => {
			console.log('Animal.fetch(1): ', animal);

			animal.readProportions().subscribe((size) => {

				console.log('animal.readProportions(): ', size);

				done();
			});

		});
	});

	it('should fetch animal name async', (done) => {

		Animal.names().subscribe((names) => {
			console.log('Animal.names(): ', names);

			done();
		});
	});
});

// Create Potion API
const potion = new Potion();

// Potion resources
class Ping extends Item {}

class Animal extends Item {
	readProportions = Route.GET('/proportions');
	name: string;

	static names = Route.GET('/names');
}

// Register API resources
potion.register('/animal', Animal);
potion.register('/ping', Ping);
