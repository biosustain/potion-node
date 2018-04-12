import {
    forwardRef,
    Inject,
    NgModule,
    Optional
} from '@angular/core';
import {HttpClientModule} from '@angular/common/http';

import {
    Potion,
    POTION_PROVIDER,
    POTION_RESOURCES,
    PotionResources
} from './potion';


/**
 * Provide a way to register Potion resources when the app is bootstrapped.
 *
 * @example
 * // app.resources.ts
 * import {PotionResources, PotionModule} from 'potion-client/@angular';
 * export const appResources: PotionResources = {
 *     '/engine': Engine,
 * 	   '/car': [Car, {
 * 	       readonly: ['production']
 * 	   }]
 * };
 *
 * // app.module.ts
 * import {AppComponent} from './app.component'
 * import {resources} from './app.resources';
 * @NgModule({
 *     imports: [PotionModule],
 *     bootstrap: [AppComponent],
 *     providers: [
 *         {
 *             provide: POTION_RESOURCES,
 *             useValue: resources,
 *             multi: true
 *         }
 *     ]
 * }
 * export class AppModule {}
 */
@NgModule({
    imports: [HttpClientModule],
    providers: [
        POTION_PROVIDER
    ]
})
export class PotionModule {
    constructor(
        @Inject(forwardRef(() => Potion)) potion: Potion,
        @Optional() @Inject(POTION_RESOURCES) resources: PotionResources[]
    ) {
        potion.registerFromProvider(resources || []);
    }
}


export * from './potion';
