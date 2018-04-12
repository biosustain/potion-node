# AngularJS

This package can be used with [AngularJS](https://angularjs.org) version `v1.6` and above.


### Registering Resources
-------------------------
```ts
import angular from 'angular';
import {Item, Route, potion} from 'potion-client/angularjs';

angular.module('myApp', [potion.name])
    .factory('Foo', ['potion', (potion) => {
        // Remeber that resources can also be registered using `@potion.registerAs('/foo')`
        class Foo extends Item {
            static bars = Route.GET('/bar');
            name: string;
            bar = Route.GET('/bar');
        }

        // If the `@potion.registerAs('/foo')` decorator is used,
        // the below is not needed.
        return potion.register('/foo', Foo);
    }]);
```


### Using Resources
-------------------
```ts
import angular from 'angular';
import {potion} from 'potion-client/angularjs';

angular.module('myApp', [potion.name])
    .controller('MyAppController', ['Foo', (Foo) => {
        const foo = Foo.fetch(1);
    }]);
```


### Configuring Potion
----------------------
```ts
import angular from 'angular';
import {potion} from 'potion-client/angularjs';

angular.module('myApp', [potion.name])
    .config(['potionProvider', (potionProvider) => {
    	potionProvider.config({prefix: ''});
    }]);
```
