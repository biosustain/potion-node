import {NgModule, Inject, Optional} from '@angular/core';
import {HttpModule} from '@angular/http';

import {
	POTION_RESOURCES,
	POTION_PROVIDER,
	PotionResources,
	Potion
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
	imports: [HttpModule],
	providers: [
		POTION_PROVIDER
	]
})
export class PotionModule {
	constructor(@Optional() @Inject(POTION_RESOURCES) resources: PotionResources[], potion: Potion) {
		potion.registerFromProvider(resources || []);
	}
}
