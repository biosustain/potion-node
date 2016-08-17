// TODO: we need to cleanup a bit, it's starting to get messy
import {NgModule, ModuleWithProviders} from '@angular/core';
import {Http, HttpModule} from '@angular/http';
// TODO: see if somehow it could be removed
import {OpaqueToken} from '@angular/core'; // tslint:disable-line:no-unused-variable

import {
	POTION_RESOURCES,
	POTION_CONFIG,
	POTION_HTTP,
	Potion,
	PotionResources
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
	imports: [HttpModule],
	providers: [
		Potion,
		{
			provide: POTION_CONFIG,
			useValue: {}
		},
		{
			provide: POTION_HTTP,
			useExisting: Http
		}
		// {
		// 	provide: Potion,
		// 	useClass: Potion,
		// 	deps: [
		// 		POTION_RESOURCES,
		// 		POTION_CONFIG,
		// 		POTION_HTTP
		// 	]
		// }
	]
})
export class PotionModule {
	static forRoot(resources: PotionResources): ModuleWithProviders {
		return {
			ngModule: PotionModule,
			// App-wide service singletons
			providers: [
				{
					provide: POTION_RESOURCES,
					useValue: resources,
					multi: true
				}
			]
		};
	}
}


export const POTION_PROVIDERS = [
	{
		provide: POTION_RESOURCES,
		useValue: {},
		multi: true
	},
	{
		provide: POTION_CONFIG,
		useValue: {}
	},
	{
		provide: POTION_HTTP,
		useExisting: Http
	},
	{
		provide: Potion,
		useClass: Potion,
		deps: [
			POTION_RESOURCES,
			POTION_CONFIG,
			POTION_HTTP
		]
	}
];
