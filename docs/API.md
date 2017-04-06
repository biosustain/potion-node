# API

Note that all examples are using this package as a standalone package, or [Fetch](FETCH.md), but in principle,
the rest of the implementations follow the same pattern.

For information about usage with specific frameworks, see:
* [Angular](ANGULAR.md)
* [AngularJS](ANGULARJS.md)
* [Fetch](FETCH.md)

Furthermore, all routes created with `Route` and all methods on `Item` return a [Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise).


### Configuration
-----------------
No matter how you use this package (with Angular, Fetch, etc.) you can configure the `{host}`, `{prefix}` and `{cache}`.

The `{host}` can be useful if you're hosting the API at a different host than where the app is run:
```ts
import {Potion} from 'potion';
const potion = new Potion({
    host: 'http://domain.com'
});
```

Whereas the `{prefix}` is useful if all API routes are under the same root path:
```ts
import {Potion} from 'potion';
const potion = new Potion({
    prefix: '/api'
});
```

The `{cache}` defaults to in-memory caching, but you can easily change that by implementing the `ItemCache`:
```ts
import {Potion, ItemCache} from 'potion';

class CustomCache<T> implements ItemCache<T> {
    get(key: string): T { ... }
    put(key: string, item: T): T { ... }
    remove(key: string): { ... }
}

const potion = new Potion({
    cache: new CustomCache<Item>()
});
```

### Item
--------
An `Item` is an abstract class that is not meant to be used as standalone.
It's meant to be extended by resources so that the resources are able to use the `Item`'s API:
```ts
import {Item} from 'potion';
class Foo extends Item {}
```

If you'd like to set some of the properties to read only (any requests to the backend will omit those properties),
you can do it either directly on the resource using property decorators:
```ts
import {Item, readonly} from 'potion';

class Foo extends Item {
    @readonly
    name: string;
}
```

Or when the resource is registered:
```ts
import {Item} from 'potion';

@potion.registerAs('/foo', {
    readonly: ['name']
})
class Foo extends Item {
    name: string;
}
```

#### Querying
Every resource has `.fetch()`, `.query()` and `.first()` static methods that can be used to query that resource.

`.fetch()` will retrieve a resource by id:
```ts
import {Item} from 'potion';
class Foo extends Item {}

const foo = Foo.fetch(1);
```

**NOTE**: HTTP caching is enabled by default when retrieving resources by id, to disable it:
```ts
const foo = Foo.fetch(1, {cache: false});
```

Whereas `.query()` and `.first()` will query multiple resource (the latter returning the first one):
```ts
import {Item} from 'potion';
class Foo extends Item {}

const foos = Foo.query();
const firstFoo = Foo.first();
```

When querying, additional params can be provided (see [Filtering & Sorting](http://potion.readthedocs.io/en/latest/quickstart.html#filtering-sorting)):
```ts
import {Item} from 'potion';
class Foo extends Item {}

const query = {
    where: {name: 'John'},
    sort: {name: false}
};

const foos = Foo.query(query);
const firstFoo = Foo.first(query);
```

You can also retrieve paginated items which return a `Pagination` instance (see [Pagination](http://potion.readthedocs.io/en/latest/quickstart.html#pagination)):
```ts
import {Item} from 'potion';
class Foo extends Item {}

const query = {
    perPage: 25,
    page: 1
};

const foos = Foo.query(query, {paginated: true});
```

A `Pagination` instance is an iterable object so you can easily loop over each item:
```ts
const foos = Foo.query(query, {paginated: true});

foos.then((foos) => {
    for (const foo of foos) {
        ...
    }
});
```

And if you want to switch pages:
```ts
const foos = Foo.query(query, {paginated: true});

foos.then((foos) => {
    foos.page = 2;
    // Or
    foos.changePageTo(2)
        .then(() => { ... })
});
```

There are also additional properties on a `Pagination` instance:
* `length` *{number}* - total count of items on the current page;
* `page` *{number}* - current page;
* `perPage` *{number}* - count of items are on a page;
* `pages` *{number}* - total count of pages;
* `total` *{number}* - total count of items.

#### Create/Update/Delete
If you wish to create a new resource instance you can simply:
```ts
import {Item} from 'potion';
class Foo extends Item {}

const foo = new Foo();
foo.save()
```

If you wish to update an instance:
```ts
import {Item} from 'potion';
class Foo extends Item {}

const foo = Foo.fetch(1);
foo.then((foo) => foo.update({name: 'Jane'}));
```

Or you can use the `.save()` instance method which works as an upsert:
```ts
import {Item} from 'potion';
class Foo extends Item {}

const foo = Foo.fetch(1);
foo.then((foo) => {
    foo.name = 'John';
    return foo.save();
});
``` 

And to delete a resource:
```ts
import {Item} from 'potion';
class Foo extends Item {}

const foo = Foo.fetch(1);
foo.then((foo) => foo.destroy());
```

#### Compare
You can also compare two instances:
```ts
import {Item} from 'potion';
class Foo extends Item {}

const jane = Foo.fetch(1);
const joe = Foo.fetch(2);

Promise.all([jane, joe])
    .then(([jane, joe]) => jane.equals(joe));
```


### Route
---------
`Route` can be used to create methods that make API calls to a Potion endpoint. It supports the following HTTP verbs:
* `Route.GET`
* `Route.POST`
* `Route.PUT`
* `Route.PATCH`
* `Route.DELETE`

It can be used for both instance and static routes:
```ts
import {Route, Item} from 'potion';

class Foo extends Item {
    static bars = Route.GET('/bars');
    bar = Route.GET('/bar');
}
```

Furthermore, all `Route` methods (besides `DELETE`) accept additional params, same as the [Item](#item):
```ts
import {Route, Item} from 'potion';

class Foo extends Item {
    static bars = Route.GET('/bars');
    addBar = Route.POST('/bar');
}

const foo = Foo.fetch(1);

const bars = Foo.bars({where: {name: 'John'}}, {paginate: true});

foo.then((foo) => foo.addBar({
    name: 'Jane'
}));
```
