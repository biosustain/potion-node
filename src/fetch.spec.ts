import {Potion} from './fetch';
import {Item, Route} from "./potion";

const fetchMock = require('fetch-mock');


describe('Potion (Node)', () => {

	beforeEach(() => {
		fetchMock.mock('http://localhost/animal/123', {
			name: 'Sloth'
		});
		fetchMock.mock('http://localhost/animal/123/proportions', {
			height: 2,
			weight: 2450
		});
	});

	afterEach(() => {
		fetchMock.restore();
	});

	it('should pass sanity check', () => {
		expect(true).toBe(true);
	});

	it('should fetch animal async', (done) => {

		Animal.fetch(123).subscribe((animal: Animal) => {
			console.log('Animal.fetch(123): ', animal);

			animal.readProportions().subscribe((size) => {

				console.log('animal.readProportions(): ', size);

				done();
			});

		});
	});
});


class Animal extends Item {
	uri: string;
	readProportions = Route.GET('/proportions');
	name: string;

	static names = Route.GET('/names');
}

const potion = new Potion();
potion.register('/animal', Animal);
