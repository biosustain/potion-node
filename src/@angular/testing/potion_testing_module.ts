import {NgModule} from '@angular/core';
import {
	BaseRequestOptions,
	ConnectionBackend,
	Http,
	HttpModule
} from '@angular/http';
import {MockBackend} from '@angular/http/testing';

import {PotionModule} from '../potion_module';
import {POTION_PROVIDER} from '../potion';


export function provideHttpFactory(connectionBackend: ConnectionBackend, defaultOptions: BaseRequestOptions): Http {
	return new Http(connectionBackend, defaultOptions);
}


/**
 * PotionTestingModule can be used for testing the PotionModule.
 */
@NgModule({
	imports: [HttpModule],
	exports: [PotionModule],
	providers: [
		POTION_PROVIDER,
		// Angular 2 Http
		{
			provide: Http,
			useFactory: provideHttpFactory,
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
