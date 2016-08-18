import {NgModule} from '@angular/core';
import {
	HttpModule,
	ConnectionBackend,
	BaseRequestOptions,
	Http
} from '@angular/http';
import {MockBackend} from '@angular/http/testing';

import {PotionModule} from '../potion_module';
import {
	POTION_RESOURCES,
	POTION_HTTP,
	POTION_CONFIG,
	Potion
} from '../potion';


/**
 * PotionTestingModule can be used for testing the PotionModule.
 */
@NgModule({
	imports: [HttpModule],
	exports: [PotionModule],
	providers: [
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
		},
		// Angular 2 Http
		{
			provide: Http,
			useFactory: (connectionBackend: ConnectionBackend, defaultOptions: BaseRequestOptions) => {
				return new Http(connectionBackend, defaultOptions);
			},
			deps: [
				MockBackend,
				BaseRequestOptions
			]
		},
		BaseRequestOptions,
		MockBackend
	]
})
export class PotionTestingModule {
}
