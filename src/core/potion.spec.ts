// tslint:disable: max-classes-per-file prefer-function-over-method no-empty
import {ItemCache, PotionBase, RequestOptions} from './potion';
import {async, isAsync, isReadonly} from './metadata';
import {Item} from './item';
import {Route} from './route';


describe('potion/core', () => {
    describe('potion.ts', () => {
        describe('Potion()', () => {
            it('should have {host, prefix, cache} configurable properties', () => {
                class Potion extends PotionBase {
                    protected request(): any {}
                }

                const cache = new MockCache();
                const potion = new Potion({
                    cache,
                    host: 'http://localhost:8080',
                    prefix: '/api'
                });

                expect(potion.host).toEqual('http://localhost:8080');
                expect(potion.prefix).toEqual('/api');
                expect(potion.cache).toEqual(cache);
            });

            describe('.register()', () => {
                let potion: PotionBase;
                let cache: MockCache;

                beforeEach(() => {
                    class Potion extends PotionBase {
                        protected request(): Promise<any> {
                            return Promise.resolve({});
                        }
                    }

                    cache = new MockCache();
                    potion = new Potion({
                        cache,
                        host: 'http://localhost:8080',
                        prefix: '/api'
                    });
                });

                afterEach(() => {
                    potion = null as any;
                    cache.clear();
                });

                it('should add new resources', () => {
                    class User extends Item {}

                    potion.register('/user', User);

                    expect(Object.keys(potion.resources).length).toEqual(1);
                    expect(potion.resources['/user']).not.toBeUndefined();
                });

                it('should add new resources with config', () => {
                    class User extends Item {
                        foo: any;
                        bar: string;
                    }

                    potion.register('/user', User, {
                        readonly: ['foo'],
                        async: ['bar']
                    });

                    const foo = new User();

                    expect(Object.keys(potion.resources).length).toEqual(1);
                    expect(potion.resources['/user']).not.toBeUndefined();
                    expect(isAsync(User, 'bar')).toBe(true);
                    expect(isReadonly(foo, 'foo')).toBe(true);
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
                let potion: PotionBase;

                beforeEach(() => {
                    class Potion extends PotionBase {
                        protected request(): Promise<any> {
                            return Promise.resolve({});
                        }
                    }

                    potion = new Potion();
                });

                afterEach(() => {
                    potion = null as any;
                });

                it('should add new resources', () => {
                    @potion.registerAs('/user')
                    class User extends Item {}

                    expect(Object.keys(potion.resources).length).toEqual(1);
                    const resource = potion.resources['/user'];

                    expect(resource).not.toBeUndefined();
                    expect(resource === User).toBeTruthy();
                });
            });

            describe('.resource()', () => {
                let potion: PotionBase;

                beforeEach(() => {
                    class Potion extends PotionBase {
                        protected request(): Promise<any> {
                            return Promise.resolve({});
                        }
                    }

                    potion = new Potion();
                });

                afterEach(() => {
                    potion = null as any;
                });

                it('should retrieve a registered resource by resource uri', () => {
                    @potion.registerAs('/user')
                    class User extends Item {}
                    const res = potion.resource('/user');
                    expect(res).toEqual(User);
                });

                it('should retrieve a registered resource by item uri', () => {
                    @potion.registerAs('/user')
                    class User extends Item {}
                    const res = potion.resource('/user/1');
                    expect(res).toEqual(User);
                });

                it('should return undefined otherwise', () => {
                    @potion.registerAs('/user')
                    class User extends Item {}
                    const res = potion.resource('/foo/1');
                    expect(res).not.toEqual(User);
                });
            });

            describe('.fetch()', () => {
                it('should correctly serialize {body, params} to Potion JSON params when making a request', async () => {
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

                    await potion.fetch('/user', {
                        method: 'POST',
                        params: {isAdmin: false},
                        body: {
                            foo,
                            firstName: 'John',
                            lastName: 'Doe',
                            birthDate: today,
                            features: [{eyeColor: 'blue'}]
                        }
                    });
                    expect(Object.keys(data)).toEqual(['foo', 'first_name', 'last_name', 'birth_date', 'features']);
                    expect(Object.keys(params)).toEqual(['is_admin']);

                    expect(data.birth_date).toEqual({$date: today.getTime()});
                    expect(data.features).toEqual([{eye_color: 'blue'}]);
                    expect(data.foo).toEqual({$ref: '/api/foo/1'});
                });

                it('should fail if a request for an unregistered resource is made', async () => {
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

                    try {
                        await potion.fetch('/bar/1');
                    } catch (err) {
                        expect(err.message.includes('/bar/1')).toBeTruthy();

                    }
                });
            });

            describe('.fetch()', () => {
                let cache: MockCache;
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

                    cache = new MockCache();
                    const potion = new Potion({cache});

                    potion.register('/user', User);
                    potion.register('/car', Car);
                    potion.register('/engine', Engine);
                    potion.register('/person', Person);
                    potion.register('/foo', Foo);
                });

                afterEach(() => {
                    cache.clear();
                });

                it('should correctly deserialize Potion server response', async () => {
                    const user = await User.fetch<User>(1);
                    expect(user.id).toEqual(1);
                    expect(user.createdAt instanceof Date).toBeTruthy();
                });

                it('should always cache the Item(s)', async () => {
                    await User.fetch(1);
                    expect(cache.get('/user/1')).not.toBeUndefined();
                });

                it('should automatically resolve references', async () => {
                    const car = await Car.fetch<Car>(1);
                    expect(car.user instanceof User).toBe(true);
                    expect(car.user.id).toEqual(1);
                });

                it('should not resolve before references are populated', async () => {
                    const [user, car] = await Promise.all([User.fetch<User>(2), Car.fetch<Car>(2)]);
                    expect(cache.get('/user/2')).not.toBeUndefined();
                    expect(user instanceof (User as any)).toBe(true);
                    expect(user.id).toEqual(2);
                    expect(user.createdAt instanceof Date).toBe(true);
                    expect(user.parent instanceof (User as any)).toBe(true);
                    expect(cache.get('/car/2')).not.toBeUndefined();
                    expect(cache.get('/user/2')).not.toBeUndefined();
                    expect(car.user).not.toBeUndefined();
                    expect(car.user instanceof (User as any)).toBe(true);
                    expect(car.user.id).toEqual(2);
                    expect(car.user.createdAt instanceof Date).toBe(true);
                    expect(car.user.parent instanceof (User as any)).toBe(true);
                });

                it('should work with circular references', async () => {
                    const person = await Person.fetch<Person>(1);
                    expect(person.sibling instanceof Person).toBeTruthy();
                    expect(person.sibling.sibling instanceof Person).toBeTruthy();
                });

                it('should return the original request response for {$schema} references', async () => {
                    const json = await User.schema();
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
                });

                it('should resolve {$ref: "#"} to root item', async () => {
                    const engine = await Engine.fetch<Engine>(1);
                    expect(engine.base).toEqual(engine);
                });

                it('should resolve {$ref: "#"} to any root object', async () => {
                    const json = await Foo.bar();
                    expect(json.pong).toEqual(json);
                });

                it('should work with responses that provide {$id, $type} instead of {$uri}', async () => {
                    const [foo1, foo2] = await Promise.all([Foo.fetch(1), Foo.fetch(uuid)]);
                    expect(foo1.uri).toEqual('/foo/1');
                    expect(foo2.uri).toEqual(`/foo/${uuid}`);
                });

                it('should work with {$uri} as string', async () => {
                    const user = await User.fetch<User>(uuid);
                    expect(user.id).toEqual(uuid);
                    expect(user.createdAt instanceof Date).toBeTruthy();
                });
            });

            describe('Async Properties', () => {
                let potion: PotionBase;
                let potionFetchSpy: jasmine.Spy;

                class User extends Item {
                    @async
                    siblings: Promise<User[]>;
                }
                class Car extends Item {
                    @async
                    user: Promise<User>;
                }

                beforeEach(() => {
                    potionFetchSpy = jasmine.createSpy('request');

                    class Potion extends PotionBase {
                        protected request(uri: string): Promise<any> {
                            potionFetchSpy(uri);
                            switch (uri) {
                                case '/user/1':
                                    return Promise.resolve({
                                        body: {
                                            $uri: '/user/1',
                                            siblings: [
                                                {$ref: '/user/2'},
                                                {$ref: '/user/3'}
                                            ]
                                        }
                                    });
                                case '/user/2':
                                    return Promise.resolve({
                                        body: {
                                            $uri: '/user/2',
                                            siblings: [
                                                {$ref: '/user/1'},
                                                {$ref: '/user/3'}
                                            ]
                                        }
                                    });
                                case '/user/3':
                                    return Promise.resolve({
                                        body: {
                                            $uri: '/user/3',
                                            siblings: [
                                                {$ref: '/user/1'},
                                                {$ref: '/user/2'}
                                            ]
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
                                default:
                                    break;
                            }
                            return Promise.resolve({});
                        }
                    }

                    potion = new Potion({});

                    potion.register('/user', User);
                    potion.register('/car', Car);
                });

                it('should not automatically resolve references for properties that are marked as @async', async () => {
                    const car = await Car.fetch<Car>(1);
                    expect(car instanceof Car).toBeTruthy();
                    expect(car.id).toEqual(1);
                    expect(potionFetchSpy).toHaveBeenCalledTimes(1);
                });

                it('should resolve references only when the property is accessed', async () => {
                    const car = await Car.fetch<Car>(1);
                    expect(potionFetchSpy).toHaveBeenCalledTimes(1);

                    const user1Promise = car.user;
                    expect(user1Promise instanceof Promise).toBeTruthy();

                    // User 1
                    const user1 = await user1Promise;
                    expect(user1 instanceof User).toBeTruthy();
                    expect(user1.id).toEqual(1);

                    expect(potionFetchSpy).toHaveBeenCalledTimes(2);

                    // User 1 siblings
                    const user1SiblingsPromise = user1.siblings;
                    expect(user1SiblingsPromise instanceof Promise).toBeTruthy();
                    const user1Siblings = await user1SiblingsPromise;
                    expect(Array.isArray(user1Siblings)).toBeTruthy();
                    expect(user1Siblings.every(sibling => sibling instanceof User)).toBe(true);

                    // User 1/2 as siblings
                    const [user2, user3] = user1Siblings;
                    expect(user2.id).toEqual(2);
                    expect(user3.id).toEqual(3);

                    // User 2 siblings
                    const user2SiblingsPromise = user2.siblings;
                    expect(user2SiblingsPromise instanceof Promise).toBeTruthy();
                    const user2Siblings = await user2SiblingsPromise;
                    expect(Array.isArray(user2Siblings)).toBeTruthy();
                    expect(user2Siblings.every(sibling => sibling instanceof User)).toBe(true);

                    // User 2/3 as siblings
                    const [user1S, user3S] = user2Siblings;
                    expect(user1S.id).toEqual(1);
                    expect(user3S.id).toEqual(3);

                    // User 3 siblings
                    const user3SiblingsPromise = user3.siblings;
                    expect(user3SiblingsPromise instanceof Promise).toBeTruthy();
                    const user3Siblings = await user3SiblingsPromise;
                    expect(Array.isArray(user3Siblings)).toBeTruthy();
                    expect(user3Siblings.every(sibling => sibling instanceof User)).toBe(true);

                    // User 1/2 as siblings
                    const [user1SS, user2S] = user3Siblings;
                    expect(user1SS.id).toEqual(1);
                    expect(user2S.id).toEqual(2);
                });

                it('should cache getters', async () => {
                    const car = await Car.fetch<Car>(1);
                    expect(potionFetchSpy).toHaveBeenCalledTimes(1);

                    const usersPromise = Promise.all([car.user, car.user, car.user]);

                    const users = await usersPromise;
                    for (const user of users) {
                        expect(user instanceof User).toBe(true);
                        expect(user.id).toEqual(1);
                    }

                    expect(potionFetchSpy).toHaveBeenCalledTimes(2);
                });
            });
        });
    });
});


class MockCache implements ItemCache<Item> {
    private memcache: Map<string, any> = new Map();

    has(key: string): boolean {
        return this.memcache.has(key);
    }
    get(key: string): Promise<Item> {
        return Promise.resolve(this.memcache.get(key));
    }
    put(key: string, item: Promise<Item>): Promise<Item> {
        this.memcache.set(key, item);
        return Promise.resolve(item);
    }
    remove(key: string): void {
        this.memcache.delete(key);
    }
    clear(): void {
        this.memcache.clear();
    }
}
