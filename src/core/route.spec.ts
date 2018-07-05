/* tslint:disable: prefer-function-over-method max-classes-per-file */

import {isFunction} from './utils';
import {PotionBase} from './potion';
import {Item} from './item';
import {Route} from './route';


describe('potion/core', () => {
    describe('route.ts', () => {
        describe('Route', () => {
            class User extends Item {
                static getNames: any = Route.GET<string[]>('/names');
                static patchNames: any = Route.PATCH<string[]>('/names');
                static addName: any = Route.PUT<string[]>('/names');
                static setNames: any = Route.POST<string[]>('/names');
                static deleteName: any = Route.DELETE<string[]>('/names');
                attributes: any = Route.GET<{height: number, weight: number}>('/attributes');
            }

            beforeEach(() => {
                const names = [
                    'John Doe',
                    'Jane Doe'
                ];

                class Potion extends PotionBase {
                    protected request(uri: string, {method, body}: any): Promise<any> {
                        switch (uri) {
                            case '/user/1':
                                return Promise.resolve({body: {$uri: '/user/1'}});
                            case '/user/names':
                                if ((method === 'POST' || method === 'PATCH') && Array.isArray(body)) {
                                    names.push(...body);
                                } else if (method === 'PUT') {
                                    names.push(body);
                                } else if (method === 'DELETE') {
                                    names.splice(names.indexOf(body), 1);
                                }
                                return Promise.resolve({
                                    body: names,
                                    headers: {}
                                });
                            default:
                                break;
                        }

                        return Promise.resolve({});
                    }
                }

                const potion = new Potion();
                potion.register('/user', User);

            });

            it('should allow for usage as instance property', async () => {
                const user = await User.fetch<User>(1);
                expect(isFunction(user.attributes)).toBe(true);
            });

            it('should allow for usage as static property', () => {
                expect(isFunction(User.getNames)).toBe(true);
            });

            describe('.GET()', () => {
                it('should GET', async () => {
                    const names = await User.getNames();
                    expect(names instanceof Array).toBe(true);
                    expect(names.length).toEqual(2);
                });
            });

            describe('.POST()', () => {
                it('should POST', async () => {
                    const names = await User.setNames(['Foo', 'Bar']);
                    expect(names instanceof Array).toBe(true);
                    expect(names.length).toEqual(4);
                });
            });

            describe('.PATCH()', () => {
                it('should PATCH', async () => {
                    const names = await User.patchNames(['Foo']);
                    expect(names instanceof Array).toBe(true);
                    expect(names.length).toEqual(3);
                });
            });

            describe('.PUT()', () => {
                it('should PUT', async () => {
                    const names = await User.addName('Foo');
                    expect(names instanceof Array).toBe(true);
                    expect(names.length).toEqual(3);
                });
            });

            describe('.DELETE()', () => {
                it('should DELETE', async () => {
                    const names = await User.deleteName('Jane Doe');
                    expect(names instanceof Array).toBe(true);
                    expect(names.length).toEqual(1);
                });
            });
        });
    });
});
