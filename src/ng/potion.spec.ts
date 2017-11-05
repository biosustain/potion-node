/* tslint:disable: max-classes-per-file no-magic-numbers */
import {Component, ElementRef, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {async as ngAsync, inject, TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';

import {async} from '../core/metadata';
import {Item} from '../core/item';
import {
    Potion,
    POTION_CONFIG,
    POTION_PROVIDER
} from './potion';


describe('potion/ng', () => {
    describe('POTION_CONFIG', () => {
        const POTION_HOST = 'https://localhost';
        const POTION_PREFIX = '/test';

        beforeEach(ngAsync(() => {
            TestBed.configureTestingModule({
                imports: [
                    // Angular Http mock factories are here
                    HttpClientTestingModule
                ],
                providers: [
                    POTION_PROVIDER,
                    {
                        provide: POTION_CONFIG,
                        useValue: {
                            host: POTION_HOST,
                            prefix: POTION_PREFIX
                        }
                    }
                ]
            });
        }));

        it('should configure Potion({host, prefix, cache}) properties', inject([Potion], (potion: Potion) => {
            expect(potion.host).toEqual(POTION_HOST);
            expect(potion.prefix).toEqual(POTION_PREFIX);
        }));
    });

    describe('Potion()', () => {
        beforeEach(ngAsync(() => {
            TestBed.configureTestingModule({
                imports: [
                    // Angular Http mock factories are here
                    HttpClientTestingModule
                ],
                providers: [
                    POTION_PROVIDER
                ]
            });
        }));

        afterEach(() => inject([HttpTestingController], (controller: HttpTestingController) => {
            controller.verify();
        }));

        describe('.request()', () => {
            it('should return a Promise', inject([Potion], (potion: Potion) => {
                expect(potion.fetch('/ping') instanceof Promise).toBe(true);
            }));

            it('should make a XHR request', done => {
                const controller: HttpTestingController = TestBed.get(HttpTestingController);
                const potion: Potion = TestBed.get(Potion);

                potion.fetch('/ping')
                    .then(() => {
                        done();
                    });

                controller.expectOne('/ping')
                    .flush({});
            });

            it('should return a Promise with data', done => {
                const controller: HttpTestingController = TestBed.get(HttpTestingController);
                const potion: Potion = TestBed.get(Potion);

                potion.fetch('/ping')
                    .then(data => {
                        expect(data).not.toBeUndefined();
                        expect(data).toEqual({pong: true});
                        done();
                    });

                controller.expectOne('/ping')
                    .flush({
                        pong: true
                    });
            });

            it('should use the appropriate request method set by the {method} option', done => {
                const controller: HttpTestingController = TestBed.get(HttpTestingController);
                const potion: Potion = TestBed.get(Potion);

                potion.fetch('/ping', {method: 'PATCH'})
                    .then(() => {
                        done();
                    });

                const testReq = controller.expectOne('/ping');
                expect(testReq.request.method).toEqual('PATCH');
                testReq.flush({});
            });

            it('should set \'application/json\' content type when making POST, PUT or PATCH', done => {
                const controller: HttpTestingController = TestBed.get(HttpTestingController);
                const potion: Potion = TestBed.get(Potion);

                potion.fetch('/ping', {method: 'POST'})
                    .then(() => {
                        done();
                    });

                const testReq = controller.expectOne('/ping');
                const headers = testReq.request.headers;
                expect(headers.get('content-type')).toEqual('application/json');
                testReq.flush({});
            });

            it('should pass anything set on {body} option as the {body} property of the request in JSON format', done => {
                const controller: HttpTestingController = TestBed.get(HttpTestingController);
                const potion: Potion = TestBed.get(Potion);

                potion.fetch('/ping', {method: 'PUT', body: {pong: true}})
                    .then(() => {
                        done();
                    });

                const testReq = controller.expectOne('/ping');
                expect(JSON.parse(testReq.request.body)).toEqual({pong: true});
                testReq.flush({});
            });

            it('should pass on the query params from the {params} option', done => {
                const controller: HttpTestingController = TestBed.get(HttpTestingController);
                const potion: Potion = TestBed.get(Potion);

                potion.fetch('/ping', {method: 'GET', params: {pong: true}})
                    .then(() => {
                        done();
                    });

                const [testReq] = controller.match(req => req.url.includes('/ping'));
                const params = testReq.request.params;
                expect(params.has('pong')).toBeTruthy();
                expect(params.get('pong')).toBeTruthy();
                expect(testReq.request.url).toEqual('/ping');

                testReq.flush({});
            });

            it('should not fail when requests respond empty body', done => {
                const controller: HttpTestingController = TestBed.get(HttpTestingController);
                const potion: Potion = TestBed.get(Potion);

                potion.fetch('/ping', {method: 'DELETE'})
                    .then(response => {
                        expect(response).toBeNull();
                        done();
                    });

                controller.expectOne('/ping')
                    .flush('', {
                        status: 204,
                        statusText: ''
                    });
            });
        });
    });

    describe('Item()', () => {
        beforeEach(ngAsync(() => {
            TestBed.configureTestingModule({
                imports: [
                    // Angular Http mock factories are here
                    HttpClientTestingModule
                ],
                providers: [
                    POTION_PROVIDER
                ]
            });
        }));

        afterEach(() => inject([HttpTestingController], (controller: HttpTestingController) => {
            controller.verify();
        }));

        describe('.fetch()', () => {
            it('should use a memory cache by default to store and retrieve items', done => {
                const controller: HttpTestingController = TestBed.get(HttpTestingController);
                const potion: Potion = TestBed.get(Potion);

                @potion.registerAs('/user')
                class User extends Item {}

                User.fetch(1).then(() => {
                    expect(potion.cache.get('/user/1')).not.toBeUndefined();
                    User.fetch(1).then((user: User) => {
                        expect(user).not.toBeUndefined();
                        done();
                    });
                });

                controller.expectOne('/user/1')
                    .flush({
                        $uri: '/user/1'
                    });
            });
        });

        describe('.query()', () => {
            it('should work with circular references', done => {
                const controller: HttpTestingController = TestBed.get(HttpTestingController);
                const potion: Potion = TestBed.get(Potion);


                // Circular references mock classes
                @potion.registerAs('/m1')
                class M1 extends Item {
                    m2: M2;
                }
                @potion.registerAs('/m2')
                class M2 extends Item {
                    m3: M3;
                    m1s: M1[];
                }
                @potion.registerAs('/m3')
                class M3 extends Item {
                    m4: M4;
                    m2s: M2[];
                }
                @potion.registerAs('/m4')
                class M4 extends Item {
                    m3s: M3[];
                }


                M1.query<M1>().then((m1s: M1[]) => {
                    expect(m1s.length).toEqual(3);
                    m1s.forEach(m1 => expect(m1 instanceof M1).toBeTruthy());

                    const m4s = m1s.map(({m2}) => m2)
                        .map(({m3}) => m3)
                        .map(({m4}) => m4);

                    m4s.forEach(m4 => expect(m4 instanceof M4).toBeTruthy());

                    done();
                });


                for (const [url, body] of new Map<string, any>([
                    ['/m1', [{$ref: '/m1/1'}, {$ref: '/m1/2'}, {$ref: '/m1/3'}]],
                    ['/m1/1', {$uri: '/m1/1', m2: {$ref: '/m2/1'}}],
                    ['/m1/2', {$uri: '/m1/2', m2: {$ref: '/m2/1'}}],
                    ['/m1/3', {$uri: '/m1/3', m2: {$ref: '/m2/2'}}],
                    ['/m2/1', {$uri: '/m2/1', m1s: [{$ref: '/m1/1'}, {$ref: '/m1/2'}], m3: {$ref: '/m3/1'}}],
                    ['/m2/2', {$uri: '/m2/2', m1s: [{$ref: '/m1/3'}], m3: {$ref: '/m3/1'}}],
                    ['/m3/1', {$uri: '/m3/1', m2s: [{$ref: '/m2/1'}, {$ref: '/m2/2'}], m4: {$ref: '/m4/1'}}],
                    ['/m4/1', {$uri: '/m4/1', m3s: [{$ref: '/m3/1'}, {$ref: '/m3/2'}]}],
                    ['/m3/2', {$uri: '/m3/2', m2s: [{$ref: '/m2/3'}], m4: {$ref: '/m4/1'}}],
                    ['/m2/3', {$uri: '/m2/3', m1s: [], m3: {$ref: '/m3/2'}}]
                ]).entries()) {
                    // Pusing to the next frame will ensure we don't expect something before we ask for it
                    requestAnimationFrame(() => {
                        controller.expectOne(url)
                            .flush(body);
                    });
                }
            });
        });

    });

    describe('Async Properties', () => {
        let testBed: typeof TestBed;

        beforeEach(ngAsync(() => {
            testBed = TestBed.configureTestingModule({
                imports: [
                    CommonModule,
                    // Angular Http mock factories are here
                    HttpClientTestingModule
                ],
                declarations: [TestComponent],
                providers: [
                    POTION_PROVIDER
                ]
            });
            testBed.compileComponents();
        }));

        afterEach(() => inject([HttpTestingController], (controller: HttpTestingController) => {
            controller.verify();
        }));

        it('should work with the async pipe (e.g. {{ foo.bar | async }})', done => {
            const controller: HttpTestingController = testBed.get(HttpTestingController);
            const potion: Potion = testBed.get(Potion);

            const fixture = testBed.createComponent(TestComponent);
            const testComponent: TestComponent = fixture.debugElement.componentInstance;
            // Render component
            fixture.detectChanges();

            // Register resources
            @potion.registerAs('/bar')
            class Bar extends Item {}
            @potion.registerAs('/foo')
            class Foo extends Item {
                @async
                bar: Promise<Bar>;
            }

            Foo.fetch(1).then(foo => {
                // Set Foo instance on component
                testComponent.foo = foo;

                // Trigger change detection and render foo
                fixture.detectChanges();

                // Rendering foo will access the {bar} prop and try to resolve the Bar instance
                controller.expectOne('/bar/1')
                    .flush({
                        $uri: '/bar/1',
                        name: 'John Doe'
                    });

                // Once the Bar instance is resolved,
                // trigger another route of change detection
                fixture.detectChanges();

                foo.bar.then((bar: Bar) => {
                    fixture.detectChanges();
                    return fixture.whenRenderingDone()
                        .then(() => bar);
                }).then((bar: Bar) => {
                    const barNode: HTMLSpanElement = testComponent.bar.nativeElement;
                    expect(barNode).toBeDefined();
                    const name: any = barNode.textContent;
                    expect(name.length).toBeGreaterThan(0);
                    expect(name).toEqual(bar.name);

                    fixture.destroy();
                    done();
                });
            });

            controller.expectOne('/foo/1')
                .flush({
                    $uri: '/foo/1',
                    bar: {$ref: '/bar/1'}
                });
        });
    });
});

@Component({
    selector: 'test-component',
    template: `
        <ng-container *ngIf="foo">
            <span #bar>{{ (foo.bar | async)?.name }}</span>
        </ng-container>
    `
})
export class TestComponent {
    @ViewChild('bar') bar: ElementRef;
    set foo(foo: any) {
        this.$foo = foo;
    }
    get foo() {
        return this.$foo;
    }
    private $foo: any;
}
