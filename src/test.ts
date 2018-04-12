import {getTestBed} from '@angular/core/testing';
import {BrowserDynamicTestingModule, platformBrowserDynamicTesting} from '@angular/platform-browser-dynamic/testing';

const platform = platformBrowserDynamicTesting();
getTestBed()
    .initTestEnvironment(BrowserDynamicTestingModule, platform);
