import 'es6-shim';
import 'reflect-metadata';
import {Observable} from 'rxjs/Observable';
import 'rxjs/add/observable/fromArray';

//interface ItemConstructor {
//    _store?: Store;
//    $uri?: string;
//    //call?: (string, {any}) => any; // attached by Store after the add() method
//    //query?: (string, {any}) => Query; // attached by Store after the add() method
//    id?: number; // attached as property by Store after the add() method
//}

class Item {
    _uri: string;
    static store: Store<Item>; // XXX Store<this>
    //static get store(): Store<this> {
    //    return Reflect.getMetadata('potion:store', this.constructor);
    //}

    constructor(object: any = {}) {
        Object.assign(this, object);
    }

    exists() {
        return !!this._uri;
    }

    // TODO memoize
    get id() {
        let potion = <Potion>Reflect.getMetadata('potion', this.constructor);
        return parseInt(potion.parseURI(this._uri).params[0]);
    }
    //
    //static route(uri: string): any {
    //    let rootURI = <Potion>Reflect.getMetadata('potion:uri', this);
    //    return new Route(`${rootURI}/${uri}`);
    //}
    //
    //route(uri: string): Route {
    //    if(!this.exists()) {
    //        throw `This item has not yet been saved.`;
    //    }
    //    return new Route(`${this._uri}/${uri}`);
    //}

    //query(uri: string, options?: any): Observable<any> {
    //    //if(this.$store != undefined) {
    //    //    return new Query(this, uri, options);
    //    //} else {
    //    //    throw 'UnboundStoreException goes here';
    //    //}
    //    throw 'X';
    //}

    static fetch(id): Observable<Item> {
        return this.store.fetch(id);
    }

    //save(): this {
    //
    //    return this;
    //}
}

interface IItem {
    store?: Store<Item>;
    new (object: any): Item;
}

//class Route {
//
//    constructor(private _uri: string) {
//
//    }
//
//    get(options?: any) {
//        return Observable.of(`GET ${this._uri}: ${JSON.stringify(options)}`);
//    }
//
//    post(options?: any) {
//        return Observable.of(`POST ${this._uri}: ${JSON.stringify(options)}`);
//    }
//
//    patch(options?: any) {
//        return Observable.of(`PATCH ${this._uri}: ${JSON.stringify(options)}`);
//    }
//
//    put(options?: any) {
//        return Observable.of(`PUT ${this._uri}: ${JSON.stringify(options)}`);
//    }
//
//    delete(options?: any): Observable<any> {
//        return Observable.of(`DELETE ${this._uri}: ${JSON.stringify(options)}`);
//    }
//
//    create(options?: any) {
//        return this.post(options)
//    }
//
//    read(options?: any) {
//        return this.get(options)
//    }
//
//    update(options?: any) {
//        return this.patch(options)
//    }
//}


class Route {

    static GET() {
        // returns a function, see itemRoute
    }

    static POST() {
        // returns a function, see itemRoute
    }
}

class Store<T extends Item> {
    private _itemConstructor: IItem;
    private _potion: Potion;
    private _rootURI: string;

    constructor(itemConstructor: IItem) {
        // TODO check if missing
        this._potion = Reflect.getMetadata('potion', itemConstructor);
        this._rootURI = Reflect.getMetadata('potion:uri', itemConstructor);
        this._itemConstructor = itemConstructor;
    }


    /**
     *
     * While the item *should* have the same type as `itemConstructor`
     *
     * @param item
     */
    add(item: Object): T {
        if(!(item instanceof Item)) {
            Object.setPrototypeOf(item, this._itemConstructor.prototype);
        }

        (<T>item)._uri = `${this._rootURI}/1`;

        return <T>item;
    }


    ////
    //query(where: any): Query {
    //    return
    //}

    //update(item: T) {
    //
    //}
    //
    //remove(item: T) {
    //
    //}
    //
    fetch(id: number): Observable<T> {
        return Observable.of(new this._itemConstructor({_uri:  `${this._rootURI}/${id}`}));
    }
    //
    //fetchAll(): Query<T? { // TODO make into query
    //    // updates entries and returns them
    //}
}

//class Query {
//    public entries: Array<any>;
//    private _store: Store;
//    private _uri: string;
//    private _item: IStoreItem;//nullable
//    private _where: any;
//    private _page: number;
//    private _perPage: number;
//
//    constructor(store: Store|StoreItem, uri: string, options: any) {
//
//
//    }
//}

function readOnlyProperty(target: Object, propertyKey: string | symbol) {
    let readOnly = Reflect.getMetadata('potion:readOnly', target.constructor);
    Reflect.defineMetadata('potion:readOnly', Object.assign(readOnly || {}, {[propertyKey]: true}), target.constructor);
}

let _rawPromisesMap = new WeakMap<Item, any>();

function rawPromisesFor(item: Item) {
    if(_rawPromisesMap.has(item)) {
        return _rawPromisesMap.get(item);
    } else {
        let promises = {};
        _rawPromisesMap.set(item, promises);
        return promises
    }
}

function asyncProperty(target: Object, propertyKey: string) {
    let promises = Reflect.getMetadata('potion:promises', target.constructor);
    Reflect.defineMetadata('potion:promises', Object.assign(promises || {}, {[propertyKey]: true}), target.constructor);
    //
    //let descriptor = Object.getOwnPropertyDescriptor(target, propertyKey);
    //
    //


    if (delete this[propertyKey]) {

        // Create new property with getter and setter
        Object.defineProperty(target, propertyKey, {
            get: function () {
                let value = rawPromisesFor(this)[propertyKey];
                if (value instanceof Promise) {
                    return value;
                }
                return Promise.resolve(value)
            },
            set: function (value) {
                rawPromisesFor(this)[propertyKey] = value;
            },
            enumerable: true,
            configurable: true
        });
    }
}


class Food extends Item {
    public name: string;
}

interface IParsedURI {
    resource: IItem,
    params: string[]
}

class Potion {
    public resources = {};

    // TODO pass http in constructor

    /**
     * Fetches a given un-prefixed URI and returns a Promise for the de-serialized JSON.
     */
    fetch(uri, {method = 'GET', headers = null, data = null, params = null} = {}) {
        // Handles Potion-JSON serialization/deserialization
    }

    registerAs(uri: string): ClassDecorator {
        return (target: IItem) => {
            this.register(uri, target);
            return target;
        }
    }

    register(uri: string, resource: IItem) {
        Reflect.defineMetadata('potion', this, resource);
        Reflect.defineMetadata('potion:uri', uri, resource);
        this.resources[uri] = resource;
        resource.store = new Store(resource);
    }

    parseURI(uri: string): IParsedURI {
        uri = decodeURIComponent(uri);

        for(let resourceURI in this.resources) {
            if (uri.indexOf(`${resourceURI}/`) === 0) {
                return {
                    resource: this.resources[resourceURI],
                    params: uri.substring(resourceURI.length + 1).split('/')
                }
            }
        }

        throw new Error(`Uninterpretable or unknown resource URI: ${uri}`);
    }
}



let potion = new Potion();


function itemRoute(uri: string, {method = 'GET'} = {}): (any?) => Observable<any> {
    return function (options: any = {}) {
        if(typeof this === 'function') {
            let rootURI = <Potion>Reflect.getMetadata('potion:uri', this);
            return Observable.of(`${method} ${rootURI}${uri} ${JSON.stringify(options)}`)
        } else {
            return Observable.of(`${method} ${this.uri}${uri} ${JSON.stringify(options)}`)
        }
    }
}


@potion.registerAs('/animal')
class Animal extends Item {
    @readOnlyProperty
    public name: string;

    @asyncProperty
    @readOnlyProperty
    public favoriteFood: Food | Promise<Food>;

    /// XXX how to have ees on items?
    //@route('/friends')
    //public friends: () => Query<Animal>;

    // public readFriends = Route.GET('/friends')
    public readFriends = itemRoute('/friends');

    // public static readNoises = Route.GET('/noises')
    public static readNoises = itemRoute('/noises');

    public static store: Store<Animal>;
}



let dog = new Animal({name: 'foofy'});

potion.register('/food', Food);

console.log(potion.resources);

//
//let animalStore = new Store<Animal>(Animal);

let catObject = {
    name: 'Fluff'
};

//let cat = <Animal>Animal.store.add(catObject);
let cat = animalStore.add(catObject);

console.log(catObject === cat);
console.log("Fluff's ID:", cat.id);


console.log(Reflect.getMetadata('potion:readOnly', Animal));
console.log(Reflect.getMetadata('potion:promises', Animal));



// use with `Food | Promise<Food>`:
dog.favoriteFood = new Food({name: 'bone'});
(<Promise<Food>>dog.favoriteFood).then((food) => console.log(food));

// use with `Promise<Food>`:
//dog.favoriteFood = Promise.resolve(new Food({name: 'kitten'}));
//dog.favoriteFood.then((food) => console.log(food));

dog.favoriteFood = new Food({name: 'kitten'});

// FIXME promise resolution
console.log(rawPromisesFor(dog));


//@property({async: true})
//@property({readOnly: true})

// Animal.query('friends', {where: {age: {$lt: 5}})


//Animal.store.add(dog);
Animal.store.add(dog);


dog.readFriends()
    .subscribe((result) => console.log(result));


//Animal.route('only-small-ones')
//    .create(cat)
//    .subscribe((result) => console.log(result));


Animal.fetch(123)
    .subscribe((result) => console.log('Fetched Animal(123): ', result));

dog.readFriends({sort: {name: true}})
    .subscribe((result) => console.log('dog.readFriends():', result));


Animal.readNoises()
    .subscribe((result) => console.log('Animal.readNoises():', result));




Animal.fetch(123)
    .subscribe((result: Animal) => console.log('Animal.store.fetch(123):', result, result.name));

Animal.store.fetch(123)
    .subscribe((result) => console.log('Animal.store.fetch(123):', result, result.name));



//class ObservableStore {
//
//}
