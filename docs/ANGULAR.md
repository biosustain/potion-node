# Angular

This package can be used with [Angular](https://angular.io) version `v4` and above.
Though, it is **important** that `HttpModule` is provided as `Potion` uses `Http` as default http engine to make requests.


### Registering & Using Resources
---------------------------------
```ts
// ./main.ts
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';
import {AppModule} from './app.module.ts';

platformBrowserDynamic()
    .bootstrapModule(AppModule);


// ./app.module.ts
import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {HttpModule} from '@angular/http';
import {POTION_RESOURCES, PotionModule} from 'potion-client';

import {AppComponent} from './app.component';

import {resources} from './app.resources';

@NgModule({
	imports: [
		BrowserModule,
		HttpModule,
		PotionModule
	],
	declarations: [AppComponent],
	bootstrap: [AppComponent],
	providers: [
		// Potion resources registration
	    {
	        provide: POTION_RESOURCES,
	        useValue: resources,
	        multi: true
        }
     ]
})
export class AppModule {}


// ./app.resources.ts
import {PotionResources} from 'potion-client';
import {Foo, Bar} from './foobar';

export const resources: PotionResources = {
    '/foo': [Foo, {
        // Item configuration (it can also be done using the provided decorators)
        readonly: ['role']
    }]
    '/bar': Bar
};


// ./app.component.ts
import {Component} from '@angular/core';
import {Foo} from './foobar';

@Component({
    selector: 'my-app',
    template: `
        <h1>My Angular 2 App</h1>
        Name: {{name | async}}
    `
})
export class AppComponent {
    name: Promise<string>;

    constructor() {    
        const foo = new Foo({name: 'John Doe'});
        this.name = foo.save()
            .then((foo) => foo.name);
    }
}


// ./foobar.ts
import {Item} from 'potion-client';

export class Foo extends Item {
    name: string;
    role: string;
}
export class Bar extends Item {}
```

You can still register new resources at a later point by using the `Potion` instance (though I advise against it):
```ts
import {Component} from '@angular/core';
import {Potion, Item} from 'potion-client';

export class Person extends Item {}

@Component({
    selector: 'my-app',
    template: '<h1>My Angular 2 App</h1>'
})
class AppComponent {
    constructor(potion: Potion) {
        potion.register('/person', Person);
    }
}
```


### Configuring Potion
----------------------
If you wish to override either one of the config values or provide your own HTTP engine, you can use the following:
```ts
import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {HttpModule} from '@angular/http';
import {POTION_HTTP, POTION_CONFIG, PotionHttp} from 'potion-client';
import {resources} from './app.resources';

// Custom Http
class MyHttp implements PotionHttp {}

@NgModule({
	imports: [
		BrowserModule,
		HttpModule,
		PotionModule,
		...
	],
	providers: [
        {
            provide: POTION_CONFIG,
            useValue: {
                prefix: '/api'
            }
        },
        {
            provide: POTION_HTTP,
            useClass: MyHttp
        },
        ...
    ],
	...
})
export class AppModule {}
```
