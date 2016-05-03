# Potion

[![Build Status](https://travis-ci.org/biosustain/potion-node.svg?branch=master)](https://travis-ci.org/biosustain/potion-node)
[![Dependency Status](https://gemnasium.com/badges/github.com/biosustain/potion-node.svg)](https://gemnasium.com/github.com/biosustain/potion-node)

> A TypeScript client for APIs written in Flask-Potion.

### Installation
----------------
You can install this package via npm, but it is advised to use it with [JSPM](http://jspm.io/): 
```shell
$(node bin)/jspm install potion=npm:potion-client
```


### Usage
---------
Before you use this package, make sure you include [reflect-metadata](https://www.npmjs.com/package/reflect-metadata) and a shim for ES6/7 features ([core-js](https://github.com/zloirock/core-js) has the most comprehensive collection of shims and I advise using it).

Furthermore, this package has multiple implementations available, it can be used as:
* [standalone](#standalone) package using [Fetch API](https://developer.mozilla.org/en/docs/Web/API/Fetch_API) (make sure to include a polyfill such as [whatwg-fetch](https://github.com/github/fetch) if you are targeting a browser that does not implement the API);
* as a [AngularJS](#angularjs) module;
* as a [Angular 2](#angular-2) package.

Note that any routes created with `Route.<method>` and the following methods on `Item` return a [Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise):
* `.save()`
* `.update()`
* `.destroy()`
* `.query()`
* `.fetch()`

#### Standalone
Using the package requires you to have a ES6 env setup with either [JSPM](http://jspm.io/) or [SystemJS](https://github.com/systemjs/systemjs) alone (or any loader that can load commonjs packages).

You will first need to load `Potion` and create an instance of it in order to be able to register any API endpoints:
```js
// It will load from the main module `potion/fetch`,
// and it will use the fetch API
import {
    PotionItemCache,
    Potion,
    Item
} from 'potion';

class CustomCache<T> implements PotionItemCache<T> {
    get(key: string): T {
        // logic to fetch the item from cache
    }
    put(key: string, item: T): T {
        // logic to cache and return the item
    }
    remove(key: string): {
        // logic to remove the item from cache
    }
}

let potion = new Potion({
    host: 'http://localhost:8080', // if you are hosting the api at a different host, defaults to ''
    prefix: '/api' // if all routes are at a specific path, defaults to ''
    cache: new CustomCache<Item>() // a custom cache that implements PotionItemCache (note that by default it will use a in memory cache if a custom cache is not provided)
});
```

Now the API endpoints can be registered either using the `@potion.registerAs()` class decorator:
```js
// `Item` has been imported above,
// do not forget about it;
// and `potion` is the instance created in the above example
@potion.registerAs('/user')
class User extends Item {}
```

Or by using the `potion.register()` method:
```js
class User extends Item {}
potion.register('/user', User);
```

If there are some instance or static routes for an API endpoint that you wish to register, this can be done using:
```js
import {Route} from 'potion';

// Do not forget to load the Item and register the endpoint
class User extends Item {
    static names = Route.GET('/names');
    groups = Route.GET('/groups');
}
```

Furthermore, if you'd like to set some of the properties to read only (meaning that any requests to the backend will omit those properties), you can do it either directly on the resource using property decorators:
```js
import {Item, readonly} from 'potion';

class User extends Item {
    @readonly
    age;
}
```

Or you can do it when the resource is registered:
```js
import {Item} from 'potion';

@potion.registerAs('/user', {
    readonly: ['age']
})
class User extends Item {
    age;
}
```

Finally, to use the endpoints that were just created:
```js
// Fetch a user object by id
let user = User.fetch(1);

// Get the user groups,
// uses the instance route created with `Route.GET('/groups')`
user
    .then((user) => user.groups()})
    .then((groups) => {
        console.log(groups);
    });

// Get all user names,
// uses the static route created with `Route.GET('/names')`
let names = User.names();

// Get all users
let users = User.query();

// Update a user
user.then((john) => {
    john.update({name: 'John Doe'});
});

// Delete a user
user.then((john) => {
    john.destroy();
});

// Create and save a new user
let jane = new User({name: 'Jane Doe'});
jane.save();
```

When using the `.query()` method, you can provide additional params:
```js
let users = User.query({
    where: {name: 'John'}, // `where` can have any value
    sort: {name: false}, // and so can `sort`
    perPage: 50,
    page: 1
});

// Return paginated results
// Skip cache when making the request
let freshUsers = User.query(null, {
    paginate: true,
    cache: false
});
```

Furthermore, all Route methods (besides `DELETE`) accept additional params as well:
```js
class Car extends Item {
    static readEngines = Route.GET('/engines');
    writeSpecs = Route.POST('/specs');
}

// Get a car
let car = Car.fetch(1);

// Get all diesel engines
// Return paginated results
let engines = Car.engines({where: {type: 'Diesel'}}, {paginate: true});

// Create the car specs
car.then((car) => car.writeSpecs({
    engine: {type: 'Electric'}
}));
```

#### AngularJS
If you decide to use this package as a AngularJS module, there are a few differences from the standalone version, but the API does not change. Use the following example as a starting point:
```js
import angular from 'angular';
import {Item, Route} from 'potion/angular';

angular
    .module('myApp', ['potion'])
    // Config the Potion client
    .config(['potionProvider', (potionProvider) => {
    	potionProvider.config({prefix: ''});
    }])
    // Register a resource
    .factory('User', ['potion', (potion) => {
    
        // Resources can also be registered using `@potion.registerAs('/user')`
        class User extends Item {
            name: string;
            
            static readNames = Route.GET('/names');
            readAttributes = Route.GET('/attributes');
        }

        // If the `@potion.registerAs('/user')` decorator is used,
        // this is no longer needed.
        potion.register('/user', User);

        return User;
    }])
    .controller('MyAppController', ['User', (User) => {
        // Fetch a user object by id
        let user = User.fetch(1);
        
        // Get the user attributes using the instance route created with `Route.GET('/attributes')`
        user
            .then((user) => user.readAttributes()})
            .then((attrs) => {
                console.log(attrs);
            });
        
        // Get all user names using the static route created with `Route.GET('/names')`
        let names = User.readNames();
        
        // Get all users
        let users = User.query();
        
        // Update a user
        user.then((john) => {
            john.update({name: 'John Doe'});
        });
        
        // Delete a user
        user.then((john) => {
            john.destroy();
        });
        
        // Create and save a new user
        let jane = new User({name: 'Jane Doe'});
        jane.save();
    }]);
```

#### Angular 2
Using the package in an Angular 2 app is very similar to the above, as in there are no API changes, but a few differences in the way resources are registered:
```js
import {bootstrap} from 'angular2/platform/browser';
import {Component} from 'angular2/core';
import {HTTP_PROVIDERS} from 'angular2/http';

// Load the providers
import {
    POTION_PROVIDERS,
    PotionResources,
    Resource,
    Item
} from 'potion/angular2';

class User extends Item {}

@Component({
    selector: 'my-app',
    template: '<h1>My Angular 2 App</h1>'
})

@PotionResources({
    '/user': User
})

class App {
    constructor() {    
        let user = new User({name: 'John Doe'});
        user.save();
    }
}

// Add the providers
bootstrap(App, [
    HTTP_PROVIDERS,
    POTION_PROVIDERS
]);
```
It is important that `HTTP_PROVIDERS` is provided as `Potion` internally uses `Http`. Moreover, `@PotionResources` can be used on multiple components, but be aware that you cannot register a resource for the same path, if you do you will get an exception.


If you wish to override either of the config values, you can use `POTION_CONFIG`:
```js
import {
    Component,
    provide
} from 'angular2/core';
import {bootstrap} from 'angular2/platform/browser';

import {
    POTION_PROVIDERS,
    POTION_CONFIG
} from 'potion/angular2';

@Component({
    selector: 'my-app',
    template: '<h1>My Angular 2 App</h1>'
})

class App {}

// Add the providers
bootstrap(App, [
    POTION_PROVIDERS,
    provide(POTION_CONFIG, {
        useValue: {
            prefix: '/api-endpoint'
        }
    })
]);
```
Note that you can still register new resources at a later point by using the `Potion` instance provided by `POTION_PROVIDERS`:
```js
import {
    Component,
    provide
} from 'angular2/core';
import {bootstrap} from 'angular2/platform/browser';

import {
    POTION_PROVIDERS,
    Potion,
    Item
} from 'potion/angular2';

@Component({
    selector: 'my-app',
    template: '<h1>My Angular 2 App</h1>'
})

class App {
    constructor(potion: Potion) {
        class Engine extends Item {}
        potion.register('/engine', Engine);
    }
}

// Add the providers
bootstrap(App, [
    POTION_PROVIDERS
]);
```


### Contributing
----------------
Clone the repository `git clone https://github.com/biosustain/potion-node`, install all the deps (`npm install`, `$(npm bin)/typings install`) and start hacking.
Make sure that the builds and tests will run successfully, before you make a pull request. Follow the next steps:
- use `npm run build` to build the `.ts` files and see if any errors have occurred;
- run the tests using `npm test` (*if you wish to run tests on file change, use `$(npm bin)/karma start karma.config.js`.*);
- lint the code with `npm run lint`.

**Note**: If you add new files or remove files, make sure to edit the `"files"` field in `tsconfig.json`:
```js
"files": [
    // These files MUST always be here as they provide the type definitions
    "typings/main.d.ts",
    "node_modules/typescript/lib/lib.es7.d.ts",
    // You can change the below as you wish
    "src/angular.ts",
    "src/angular2.ts",
    "src/fetch.ts",
    "src/base.ts",
    "src/utils.ts"
]
```

If you are a contributor for the package on npm and have publish rights, you can use the following script to publish the package:
```shell
sh scripts/npm_publish.sh
```
