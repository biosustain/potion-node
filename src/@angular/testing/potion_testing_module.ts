import {NgModule,} from '@angular/core';
import {
	HttpModule,
	ConnectionBackend,
	BaseRequestOptions,
	Http
} from '@angular/http';
import {MockBackend} from '@angular/http/testing';

import {POTION_PROVIDERS, PotionModule} from '../potion_module';


/**
 * PotionTestingModule can be used for testing the PotionModule.
 */
@NgModule({
	imports: [HttpModule],
	exports: [PotionModule],
	providers: [
		POTION_PROVIDERS,
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
