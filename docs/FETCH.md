# Fetch

Using this package with [Fetch API](https://developer.mozilla.org/en/docs/Web/API/Fetch_API) requires no additional setup,
and it can be used as described in [API](API.md).


### Registering Resources
-------------------------
Make sure an instance of `Potion` is created and use that to register resources:
```ts
import {Potion} from 'potion';
const potion = new Potion({prefix: '/api'});
```

Now the API endpoints can be registered either using the `@potion.registerAs()` class decorator:
```ts
import {Item} from 'potion';
// An instance of Potion is available either globally or imported from somewhere in your app
@potion.registerAs('/foo', {
    readonly: ['name']
})
class Foo extends Item {
    name: string;
}
```

Or by using the `potion.register()` method:
```ts
import {Item, readonly} from 'potion';
class Foo extends Item {
    @readonly
    name: string;
}
potion.register('/foo', Foo);
```
