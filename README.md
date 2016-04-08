# Potion

[![Build Status](https://travis-ci.org/biosustain/potion-node.svg?branch=master)](https://travis-ci.org/biosustain/potion-node)

> A TypeScript client for APIs written in Flask-Potion.

### Installation
----------------
```shell
$(node bin)/jspm install npm:potion-client
```


### Usage
---------
Before you use this package, make sure you include [reflect-metadata](https://www.npmjs.com/package/reflect-metadata) and a shim for ES6/7 features ([core-js](https://github.com/zloirock/core-js) has the most comprehensive collection of shims and I advise using it).

Furthermore, this package has multiple implementations available, it can be used as:
* [standalone](#standalone) package using [Fetch API](https://developer.mozilla.org/en/docs/Web/API/Fetch_API) (make sure to include a polyfill such as [whatwg-fetch](https://github.com/github/fetch) if you are targeting a browser that does not implement the API);
* as a [AngularJS](#angularjs) module.

Note that any routes created with `Route.<method>` and the following methods on `Item` return a [Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise):
* `.save()`
* `.update()`
* `.destroy()`
* `.query()`
* `.fetch()`

#### Standalone
TODO

#### AngularJS
If you decide to use this package as a AngularJS module, use the following example as a starting point:
```js
import angular from 'angular';

import 'potion/angular';
// If the bellow import is used,
// the line above is not necessary.
// By importing anything from the module,
// it will implicitly load and register the angularjs module.
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
        const user = User.fetch(1);
        
        // Get the user attributes using the instance route created with `Route.GET('/attributes')`
        user
            .then((user) => user.readAttributes()})
            .then((attrs) => {
                console.log(attrs);
            });
        
        // Get all user names using the static route created with `Route.GET('/names')`
        const names = User.readNames();
        
        // Get all users
        const users = User.query();
        
        // Update a user
        user.then((john) => {
            john.update({name: 'John Doe'});
        });
        
        // Delete a user
        user.then((john) => {
            john.destroy();
        });
        
        // Create and save a new user
        const jane = new User({name: 'Jane Doe'});
        jane.save();
    }]);
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
    // these files will always stay here
	"node_modules/typescript/lib/lib.es6.d.ts",
	"typings/main.d.ts",
	// you can change the bellow as you wish
	"src/angular.ts",
	"src/fetch.ts",
	"src/base.ts",
	"src/utils.ts"
]
```

If you are a contributor for the package on npm and have publish rights, you can use the following script to publish the package:
```shell
sh scripts/npm_publish.sh
```
