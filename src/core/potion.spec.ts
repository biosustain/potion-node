/* tslint:disable: max-classes-per-file prefer-function-over-method */

import {ItemCache, PotionBase, RequestOptions} from './potion';
import {Item} from './item';
import {Route} from './route';


describe('potion/core', () => {
    describe('Potion()', () => {
        let potion: any;

        beforeEach(() => {
            class Potion extends PotionBase {
                protected request(): Promise<any> {
                    return Promise.resolve({});
                }
            }

            potion = new Potion({host: 'http://localhost:8080', prefix: '/api'});
        });

        afterEach(() => {
            potion = null;
        });

        it('should have {host, prefix, cache} configurable properties', () => {
            expect(potion.host).toEqual('http://localhost:8080');
            expect(potion.prefix).toEqual('/api');
        });

        describe('.register()', () => {
            it('should add new resources', () => {
                class User extends Item {}

                potion.register('/user', User);

                expect(Object.keys(potion.resources).length).toEqual(1);
                expect(potion.resources['/user']).not.toBeUndefined();
            });

            it('should return the added resource', () => {
                class User extends Item {}
                expect(potion.register('/user', User).name).toEqual(User.name);
            });

            it('should throw if a function is not passed', () => {
                let error: any;
                try {
                    potion.register('/foo', {} as any);
                } catch (e) {
                    error = e;
                }
                expect(error).toBeDefined();
            });
        });

        describe('.registerAs()', () => {
            it('should add new resources', () => {
                @potion.registerAs('/user')
                class User extends Item {}

                expect(Object.keys(potion.resources).length).toEqual(1);
                const resource = potion.resources['/user'];

                expect(resource).not.toBeUndefined();
                expect(resource === User).toBeTruthy();
            });
        });

        describe('.fetch()', () => {
            it('should correctly serialize {body, params} to Potion JSON params when making a request', done => {
                let params: any;
                let data: any;

                class Potion extends PotionBase {
                    protected request(_: string, options: RequestOptions): Promise<any> {
                        data = options.body;
                        params = options.params;

                        return Promise.resolve({});
                    }
                }

                const potion = new Potion({prefix: '/api'});
                const today = new Date();

                @potion.registerAs('/foo')
                class Foo extends Item {}
                const foo = new Foo();
                Object.assign(foo, {
                    $uri: '/foo/1',
                    $id: 1
                });

                potion
                    .fetch('/user', {
                        method: 'POST',
                        body: {
                            foo,
                            firstName: 'John',
                            lastName: 'Doe',
                            birthDate: today,
                            features: [{eyeColor: 'blue'}]
                        },
                        params: {isAdmin: false}
                    })
                    .then(() => {
                        expect(Object.keys(data)).toEqual(['foo', 'first_name', 'last_name', 'birth_date', 'features']);
                        expect(Object.keys(params)).toEqual(['is_admin']);

                        expect(data.birth_date).toEqual({$date: today.getTime()});
                        expect(data.features).toEqual([{eye_color: 'blue'}]);
                        expect(data.foo).toEqual({$ref: '/api/foo/1'});

                        done();
                    });

            });

            it('should fail if a request for an unregistered resource is made', done => {
                class Potion extends PotionBase {
                    protected request(): Promise<any> {
                        return Promise.resolve({
                            headers: {},
                            body: {
                                $uri: '/bar/1',
                                $id: 1
                            }
                        });
                    }
                }

                const potion = new Potion();

                potion.fetch('/bar/1')
                    // tslint:disable-next-line: no-empty
                    .then(() => {}, e => {
                        expect(e.message.includes('/bar/1')).toBeTruthy();
                        done();
                    });
            });
        });

        describe('.fetch()', () => {
            let cache: any;
            let memcache: {[key: string]: any} = {};

            const uuid = '00cc8d4b-9682-4655-ad78-1fa4b03e757d';
            const schema = {
                $schema: 'http://json-schema.org/draft-04/hyper-schema#',
                properties: {
                    created_at: {
                        additionalProperties: false,
                        default: 'Fri, 23 Sep 2016 14:47:34 GMT',
                        properties: {
                            $date: {
                                type: 'integer'
                            }
                        },
                        type: 'object'
                    }
                },
                type: 'object'
            };

            class User extends Item {
                static schema: (params?: any, options?: RequestOptions) => Promise<any> = Route.GET<any>('/schema');
                createdAt: Date;
                parent?: User;
            }

            class Car extends Item {
                user: User;
            }

            class Engine extends Item {
                car: any;
            }

            class Person extends Item {
                sibling: Person;
            }

            class Foo extends Item {
                static bar: any = Route.GET<any>('/bar');
            }

            beforeEach(() => {
                class Potion extends PotionBase {
                    protected request(uri: string): Promise<any> {
                        switch (uri) {
                            case '/user/schema':
                                return Promise.resolve({body: schema});
                            case '/user/1':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/user/1',
                                        created_at: {
                                            $date: 1451060269000
                                        }
                                    }
                                });
                            case '/user/2':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/user/2',
                                        parent: {$ref: '/user/3'},
                                        created_at: {
                                            $date: 1451060269000
                                        }
                                    }
                                });
                            case '/user/3':
                                return new Promise(resolve => {
                                    setTimeout(() => resolve({
                                        body: {
                                            $uri: '/user/3',
                                            created_at: {
                                                $date: 1451060269000
                                            }
                                        }
                                    }), 100);
                                });
                            case `/user/${uuid}`:
                                return Promise.resolve({
                                    body: {
                                        $uri: `/user/${uuid}`,
                                        created_at: {
                                            $date: 1451060269000
                                        }
                                    }
                                });

                            case '/car/1':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/car/1',
                                        user: {$ref: '/user/1'}
                                    },
                                    headers: {}
                                });
                            case '/car/2':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/car/2',
                                        user: {$ref: '/user/2'}
                                    },
                                    headers: {}
                                });
                            case '/car/3':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/car/3',
                                        user: {$ref: '/user/2'}
                                    },
                                    headers: {}
                                });

                            case '/engine/1':
                                return Promise.resolve({
                                    body: {
                                        base: {$ref: '#'},
                                        type: 'Diesel',
                                        $uri: '/engine/1'
                                    }
                                });

                            case '/person/1':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/person/1',
                                        sibling: {$ref: '/person/2'}
                                    }
                                });
                            case '/person/2':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/person/2',
                                        sibling: {$ref: '/person/1'}
                                    }
                                });

                            case '/foo/1':
                                return Promise.resolve({
                                    body: {
                                        $id: 1,
                                        $type: 'foo'
                                    },
                                    headers: {}
                                });
                            case `/foo/${uuid}`:
                                return Promise.resolve({
                                    body: {
                                        $id: uuid,
                                        $type: 'foo'
                                    },
                                    headers: {}
                                });
                            case '/foo/bar':
                                return Promise.resolve({
                                    body: {
                                        ping: true,
                                        pong: {$ref: '#'}
                                    },
                                    headers: {}
                                });
                            default:
                                break;
                        }

                        return Promise.resolve({});
                    }
                }

                class MockCache implements ItemCache<Item> {
                    has(key: string): boolean {
                        return memcache[key] !== undefined;
                    }
                    get(key: string): Promise<Item> {
                        return Promise.resolve(memcache[key]);
                    }
                    put(key: string, item: Promise<Item>): Promise<Item> {
                        memcache[key] = item;
                        return Promise.resolve(item);
                    }
                    remove(key: string): void {
                        delete memcache[key];
                    }
                    clear(): void {
                        memcache = {};
                    }
                }

                cache = new MockCache();
                const potion = new Potion({cache});

                potion.register('/user', User);
                potion.register('/car', Car);
                potion.register('/engine', Engine);
                potion.register('/person', Person);
                potion.register('/foo', Foo);

                spyOn(potion, 'fetch').and.callThrough();
                spyOn(cache, 'get').and.callThrough();
            });

            afterEach(() => {
                cache.clear();
            });

            it('should correctly deserialize Potion server response', done => {
                User.fetch<User>(1)
                    .then((user: User) => {
                        expect(user.id).toEqual(1);
                        expect(user.createdAt instanceof Date).toBeTruthy();
                        done();
                    });
            });

            it('should always cache the Item(s)', done => {
                User.fetch(1).then(() => {
                    expect(cache.get('/user/1')).not.toBeUndefined();
                    done();
                });
            });

            it('should automatically resolve references', done => {
                Car.fetch<Car>(1).then((car: Car) => {
                    expect(car.user instanceof (User as any)).toBe(true);
                    expect(car.user.id).toEqual(1);
                    done();
                });
            });

            it('should not resolve before references are populated', done => {
                Promise.all([
                    User.fetch<User>(2).then((user: User) => {
                        expect(cache.get('/user/2')).not.toBeUndefined();
                        expect(user instanceof (User as any)).toBe(true);
                        expect(user.id).toEqual(2);
                        expect(user.createdAt instanceof Date).toBe(true);
                        expect(user.parent instanceof (User as any)).toBe(true);
                    }),
                    Car.fetch<Car>(2).then((car: Car) => {
                        expect(cache.get('/car/2')).not.toBeUndefined();
                        expect(cache.get('/user/2')).not.toBeUndefined();
                        expect(car.user).not.toBeUndefined();
                        expect(car.user instanceof (User as any)).toBe(true);
                        expect(car.user.id).toEqual(2);
                        expect(car.user.createdAt instanceof Date).toBe(true);
                        expect(car.user.parent instanceof (User as any)).toBe(true);
                    })
                ]).then(() => {
                    done();
                });
            });

            it('should work with circular references', done => {
                Person.fetch<Person>(1).then((person: Person) => {
                    expect(person.sibling instanceof Person).toBeTruthy();
                    expect(person.sibling.sibling instanceof Person).toBeTruthy();
                    done();
                });
            });

            it('should return the original request response for {$schema} references', done => {
                User.schema().then(json => {
                    expect(json).toEqual({
                        $schema: 'http://json-schema.org/draft-04/hyper-schema#',
                        properties: {
                            createdAt: {
                                additionalProperties: false,
                                default: 'Fri, 23 Sep 2016 14:47:34 GMT',
                                properties: {
                                    $date: {
                                        type: 'integer'
                                    }
                                },
                                type: 'object'
                            }
                        },
                        type: 'object'
                    });
                    done();
                });
            });

            it('should resolve {$ref: "#"} to root item', done => {
                Engine.fetch<Engine>(1).then((engine: Engine) => {
                    expect(engine.base).toEqual(engine);
                    done();
                });
            });

            it('should resolve {$ref: "#"} to any root object', done => {
                Foo.bar().then((json: any) => {
                    expect(json.pong).toEqual(json);
                    done();
                });
            });

            it('should work with responses that provide {$id, $type} instead of {$uri}', done => {
                Promise.all([Foo.fetch(1), Foo.fetch(uuid)])
                    .then(([foo1, foo2]) => {
                        expect(foo1.uri).toEqual('/foo/1');
                        expect(foo2.uri).toEqual(`/foo/${uuid}`);
                        done();
                    });
            });

            it('should work with {$uri} as string', done => {
                User.fetch<User>(uuid)
                    .then((user: User) => {
                        expect(user.id).toEqual(uuid);
                        expect(user.createdAt instanceof Date).toBeTruthy();
                        done();
                    });
            });
        });
    });
});
