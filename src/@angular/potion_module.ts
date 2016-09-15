import {
	NgModule,
	ModuleWithProviders,
	Inject,
	SkipSelf,
	Optional
} from '@angular/core';
import {Http, HttpModule} from '@angular/http';

import {
	POTION_RESOURCES,
	POTION_CONFIG,
	POTION_HTTP,
	PotionResources,
	Potion
} from './potion';


/**
 * Provide a way to register Potion resources when the app is bootstrapped.
 *
 * @example
 * // app.resources.ts
 * import {PotionResources, PotionModule} from 'potion-client/@angular';
 * const appResources: PotionResources = {
 *     '/engine': Engine,
 * 	   '/car': [Car, {
 * 	       readonly: ['production']
 * 	   }]
 * };
 * export const resources = PotionModule.forRoot(appResources);
 *
 * // app.module.ts
 * import {AppComponent} from './app.component'
 * import {resources} from './app.resources';
 * @NgModule({
 *     imports: [
 *       resources
 *     ],
 *     bootstrap: [AppComponent]
 * }
 * export class AppModule {}
 */
@NgModule({
	imports: [HttpModule]
})
export class PotionModule {
	constructor(
		@Optional() @SkipSelf() parentModule: PotionModule,
		@Inject(POTION_RESOURCES) resources: PotionResources[],
		potion: Potion
	) {
		// Prevent reimport of the PotionModule.
		// https://angular.io/docs/ts/latest/guide/ngmodule.html#!#prevent-reimport
		if (parentModule) {
			throw new Error('potion-client#PotionModule has already been loaded by a different module. It can only be imported once per application.');
		}

		potion.registerFromProvider(resources);
	}
	// tslint:disable-next-line:member-ordering
	static forRoot(resources: PotionResources): ModuleWithProviders {
		return {
			ngModule: PotionModule,
			// These providers will be available as singletons (only initialized once per app) throughout the app.
			providers: [
				{
					provide: POTION_RESOURCES,
					useValue: resources,
					multi: true
				},
				{
					provide: Potion,
					useClass: Potion,
					deps: [
						POTION_CONFIG,
						POTION_HTTP
					]
				},
				{
					provide: POTION_CONFIG,
					useValue: {}
				},
				// Use Angular 2 Http by default
				{
					provide: POTION_HTTP,
					useExisting: Http
				}
			]
		};
	}
}
