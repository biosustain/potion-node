/* tslint:disable: max-classes-per-file no-magic-numbers */
import {async, inject, TestBed} from '@angular/core/testing';

import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';

import {Item} from '../core/item';
import {Route} from '../core/route';
import {
    Potion,
    POTION_PROVIDER,
    POTION_RESOURCES,
    PotionModule
} from './index';


describe('potion/ng', () => {
    describe('PotionModule', () => {
        class User extends Item {}

        beforeEach(async(() => {
            TestBed.configureTestingModule({
                imports: [
                    // Angular Http mock factories are here
                    HttpClientTestingModule,
                    PotionModule
                ],
                providers: [
                    {
                        provide: POTION_RESOURCES,
                        useValue: {
                            '/user': User
                        },
                        multi: true
                    }
                ]
            });
        }));

        afterEach(() => inject([HttpTestingController], (controller: HttpTestingController) => {
            controller.verify();
        }));

        it('should provide a Potion instance', inject([Potion], (potion: Potion) => {
            expect(potion).not.toBeUndefined();
            expect(potion instanceof Potion).toBe(true);
        }));

        it('should register any passed resources', inject([Potion], (potion: Potion) => {
            expect(potion).not.toBeUndefined();
            expect(potion.resources.hasOwnProperty('/user')).toBeTruthy();
        }));

        it('should allow Potion().request() to use Http', done => {
            const controller: HttpTestingController = TestBed.get(HttpTestingController);

            User.fetch(1).then(user => {
                expect(user).not.toBeUndefined();
                expect(user.id).toEqual(1);
                done();
            });

            controller.expectOne('/user/1')
                .flush({
                    $uri: '/user/1'
                });
        });
    });

    describe('Route', () => {
        class User extends Item {
            static names: any = Route.GET<string[]>('/names');
        }

        beforeEach(async(() => {
            TestBed.configureTestingModule({
                imports: [
                    // Angular Http mock factories are here
                    HttpClientTestingModule,
                    PotionModule
                ],
                providers: [
                    POTION_PROVIDER,
                    {
                        provide: POTION_RESOURCES,
                        useValue: {
                            '/user': User
                        },
                        multi: true
                    }
                ]
            });
        }));

        afterEach(() => inject([HttpTestingController], (controller: HttpTestingController) => {
            controller.verify();
        }));

        // TODO: We need to thoroughly test all route methods and check their integrity (request method, headers, etc.)
        describe('.GET()', () => {
            it('should return valid JSON', done => {
                const controller: HttpTestingController = TestBed.get(HttpTestingController);

                const body = [
                    'John Doe',
                    'Jane Doe'
                ];

                User.names().then((names: any) => {
                    expect(names instanceof Array).toBe(true);
                    expect(names).toEqual(body);
                    done();
                });

                controller.expectOne('/user/names')
                    .flush(body);
            });
        });
    });
});
