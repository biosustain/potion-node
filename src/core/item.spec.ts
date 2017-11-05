/* tslint:disable: max-file-line-count max-classes-per-file no-magic-numbers prefer-function-over-method  */
import {async, readonly} from './metadata';
import {ItemCache, PotionBase, RequestOptions} from './potion';
import {Item} from './item';
import {Pagination} from './pagination';


describe('potion/core', () => {
    describe('item.ts', () => {
        describe('Item.fetch()', () => {
            let potion: any;
            let cache: any;
            let memcache: {[key: string]: any} = {};

            class User extends Item {}

            beforeEach(() => {
                class Potion extends PotionBase {
                    protected request(uri: string): Promise<any> {
                        switch (uri) {
                            case '/user/1':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/user/1',
                                        created_at: {
                                            $date: 1451060269000
                                        }
                                    }
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
                        return this.get(key);
                    }
                    remove(key: string): void {
                        delete memcache[key];
                    }
                    clear(): void {
                        memcache = {};
                    }
                }

                cache = new MockCache();
                potion = new Potion({cache});

                potion.register('/user', User);

                spyOn(potion, 'request').and.callThrough();
                spyOn(cache, 'get').and.callThrough();
            });

            afterEach(() => {
                cache.clear();
            });

            it('should return an instance of Item', async () => {
                const user = await User.fetch(1);
                expect(user instanceof (User as any)).toBe(true);
            });

            it('should not trigger more requests for consequent requests for the same resource and if the first request is still pending', async () => {
                await Promise.all([User.fetch(1, {cache: false}), User.fetch(1, {cache: false})]);
                expect(potion.request).toHaveBeenCalledTimes(1);
            });

            it('should skip retrieval from Item cache if {cache} option is set to false', async () => {
                await User.fetch(1, {cache: false});
                expect(cache.get).toHaveBeenCalledTimes(1);
                expect(cache.get('/user/1')).toBeDefined();
            });
        });

        describe('Item.query()', () => {
            let potion;

            class User extends Item {}

            // Cross reference mock classes
            class Person extends Item {
                groups: Group[];
            }
            class Group extends Item {
                members: Person[];
            }

            // Circular references mock classes
            class M1 extends Item {
                m2: M2;
            }
            class M2 extends Item {
                m3: M3;
                m1s: M1[];
            }
            class M3 extends Item {
                m4: M4;
                m2s: M2[];
            }
            class M4 extends Item {
                m3s: M3[];
            }

            beforeEach(() => {
                class Potion extends PotionBase {
                    protected request(uri: string, options?: RequestOptions): Promise<any> {
                        switch (uri) {
                            case '/user':
                                return buildQueryResponse([
                                    {$ref: '/user/1'},
                                    {$ref: '/user/2'},
                                    {$ref: '/user/3'}
                                ], options);
                            case '/user/1':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/user/1'
                                    }
                                });
                            case '/user/2':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/user/2'
                                    }
                                });
                            case '/user/3':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/user/3'
                                    }
                                });

                            case '/person':
                                return buildQueryResponse([
                                    {$ref: '/person/1'},
                                    {$ref: '/person/2'}
                                ], options);
                            case '/person/1':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/person/1',
                                        groups: [
                                            {$ref: '/group/1'},
                                            {$ref: '/group/2'}
                                        ]
                                    }
                                });
                            case '/person/2':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/person/2',
                                        groups: [
                                            {$ref: '/group/1'},
                                            {$ref: '/group/2'}
                                        ]
                                    }
                                });

                            case '/group':
                                return buildQueryResponse([
                                    {$ref: '/group/1'},
                                    {$ref: '/group/2'}
                                ], options);
                            case '/group/1':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/group/1',
                                        members: [
                                            {$ref: '/person/1'},
                                            {$ref: '/person/2'}
                                        ]
                                    }
                                });
                            case '/group/2':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/group/2',
                                        members: [
                                            {$ref: '/person/1'},
                                            {$ref: '/person/2'}
                                        ]
                                    }
                                });

                            // Circular dependency mock body
                            case '/m1':
                                return buildQueryResponse([{$ref: '/m1/1'}, {$ref: '/m1/2'}, {$ref: '/m1/3'}], options);
                            case '/m1/1':
                                return Promise.resolve({body: {$uri: '/m1/1', m2: {$ref: '/m2/1'}}});
                            case '/m1/2':
                                // Simulate latency
                                return new Promise(resolve => {
                                    setTimeout(() => {
                                        resolve({body: {$uri: '/m1/2', m2: {$ref: '/m2/1'}}});
                                    }, 250);
                                });
                            case '/m1/3':
                                return Promise.resolve({body: {$uri: '/m1/3', m2: {$ref: '/m2/2'}}});
                            case '/m2/1':
                                return Promise.resolve({body: {$uri: '/m2/1', m1s: [{$ref: '/m1/1'}, {$ref: '/m1/2'}], m3: {$ref: '/m3/1'}}});
                            case '/m2/2':
                                // Simulate latency
                                return new Promise(resolve => {
                                    setTimeout(() => {
                                        resolve({body: {$uri: '/m2/2', m1s: [{$ref: '/m1/3'}], m3: {$ref: '/m3/1'}}});
                                    }, 250);
                                });
                            case '/m2/3':
                                return Promise.resolve({body: {$uri: '/m2/3', m1s: [], m3: {$ref: '/m3/2'}}});
                            case '/m3/1':
                                // Simulate latency
                                return new Promise(resolve => {
                                    setTimeout(() => {
                                        resolve({body: {$uri: '/m3/1', m2s: [{$ref: '/m2/1'}, {$ref: '/m2/2'}], m4: {$ref: '/m4/1'}}});
                                    }, 250);
                                });
                            case '/m3/2':
                                return Promise.resolve({body: {$uri: '/m3/2', m2s: [{$ref: '/m2/3'}], m4: {$ref: '/m4/1'}}});
                            case '/m4/1':
                                // Simulate latency
                                return new Promise(resolve => {
                                    setTimeout(() => {
                                        resolve({body: {$uri: '/m4/1', m3s: [{$ref: '/m3/1'}, {$ref: '/m3/2'}]}});
                                    }, 250);
                                });

                            default:
                                break;
                        }

                        return Promise.resolve({});
                    }
                }

                const memcache = new Map();
                class MockCache implements ItemCache<Item> {
                    has(key: string): boolean {
                        return memcache.has(key);
                    }

                    get(key: string): Promise<Item> {
                        return memcache.get(key);
                    }
                    put(key: string, item: Promise<Item>): Promise<Item> {
                        return memcache.set(key, item)
                            .get(key);
                    }
                    remove(key: string): void {
                        memcache.delete(key);
                    }
                }

                potion = new Potion({cache: new MockCache()});

                potion.register('/user', User);
                potion.register('/person', Person);
                potion.register('/group', Group);

                potion.register('/m1', M1);
                potion.register('/m2', M2);
                potion.register('/m3', M3);
                potion.register('/m4', M4);

                function buildQueryResponse(body: any, options: any): Promise<any> {
                    /* tslint:disable: variable-name */
                    const {page, per_page} = options.params;
                    /* tslint:enable: variable-name */

                    const response = {body};

                    if (page && per_page) {
                        Object.assign(response, {
                            body: toPages(response.body, per_page)[page - 1], // If pagination params are sent, return the appropriate page
                            headers: {
                                'x-total-count': response.body.length
                            }
                        });
                    }

                    return Promise.resolve(response);
                }
            });

            it('should return a Pagination object if {paginated: true}', async () => {
                const users = await User.query<User, Pagination<User>>({}, {
                    paginate: true
                });
                expect(users instanceof Pagination).toBe(true);
                expect(users.length).toEqual(3);
                expect(users.page).toEqual(1);
                expect(users.perPage).toEqual(25); // Default value if not set with options
                expect(users.pages).toEqual(1);
                expect(users.total).toEqual(3);
            });

            it('should contain instances of an Item if {paginated: true}', async () => {
                const users = await User.query<User, Pagination<User>>({}, {
                    paginate: true
                });
                let count = 0;
                for (const user of users) {
                    expect(user instanceof (User as any)).toBe(true);
                    count++;
                }
                expect(count).toBeGreaterThan(0);
            });

            it('should return the right page if if {paginated: true} and called with pagination params ({page, perPage})', async () => {
                const users = await User.query<User, Pagination<User>>({
                    page: 2,
                    perPage: 2
                }, {
                        paginate: true
                    });

                expect(users.length).toEqual(1);
                expect(users.page).toEqual(2);
                expect(users.perPage).toEqual(2);
                expect(users.pages).toEqual(2);
                expect(users.total).toEqual(3);
                expect(users.at(0).id).toEqual(3); // Jane
            });

            it('should update query if {paginated: true} and {page} is set on the pagination object', async () => {
                const users = await User.query<User, Pagination<User>>({
                    page: 2,
                    perPage: 2
                }, {
                        paginate: true
                    });
                expect(users.page).toEqual(2);

                await users.changePageTo(1);

                expect(users.page).toEqual(1);
                expect(users.at(0).id).toEqual(1); // John
                expect(users.length).toEqual(2);
            });

            it('should work with circular references when using pagination', async () => {
                const people = await Person.query<Person>(undefined, {
                    paginate: true
                });
                expect(people.length).toEqual(2);
                for (const person of people) {
                    expect(person.groups.length).toEqual(2);
                    for (const group of person.groups) {
                        expect(group instanceof Group).toBe(true);
                        expect(group.members.length).toEqual(2);
                        for (const member of group.members) {
                            expect(member instanceof Person).toBe(true);
                        }
                    }
                }
            });

            it('should work with circular references', async () => {
                const m1s = await M1.query<M1>({});
                expect(m1s.length).toEqual(3);
                for (const m1 of m1s) {
                    expect(m1 instanceof M1).toBeTruthy();
                }
                const m4s = m1s.map(({m2}) => m2)
                    .map(({m3}) => m3)
                    .map(({m4}) => m4);
                for (const m4 of m4s) {
                    expect(m4 instanceof M4).toBeTruthy();
                }
            });
        });

        describe('Item.first()', () => {
            let potion;

            class User extends Item {}

            beforeEach(() => {
                class Potion extends PotionBase {
                    protected request(uri: string, options?: RequestOptions): Promise<any> {
                        options = options || {};

                        switch (uri) {
                            case '/user':
                                /* tslint:disable: variable-name */
                                const {page, per_page}: any = options.params || {page: 1, per_page: 25};
                                /* tslint:enable: variable-name */

                                const response = {body: [{$ref: '/user/1'}, {$ref: '/user/2'}]};

                                if (page && per_page) {
                                    Object.assign(response, {
                                        body: toPages(response.body, per_page)[page - 1], // If pagination params are sent, return the appropriate page
                                        headers: {
                                            'x-total-count': 2
                                        }
                                    });
                                }

                                return Promise.resolve(response);
                            case '/user/1':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/user/1'
                                    }
                                });
                            case '/user/2':
                                return Promise.resolve({
                                    body: {
                                        $uri: '/user/2'
                                    }
                                });
                            default:
                                break;
                        }

                        return Promise.resolve({});
                    }
                }

                potion = new Potion();
                potion.register('/user', User);
            });

            it('should return the fist Item', async () => {
                const user = await User.first<User>();
                expect(user instanceof User).toBe(true);
            });
        });

        describe('Item()', () => {
            it('should be an instance of Item', () => {
                class User extends Item {}
                const user = new User();
                expect(user instanceof (Item as any)).toBe(true);
            });

            it('should be an instance of the child class that extended it', () => {
                class User extends Item {}
                const user = new User();
                expect(user instanceof (User as any)).toBe(true);
            });

            it('should have the same attributes it was initialized with', () => {
                class User extends Item {
                    name: string;
                    weight: number;
                    age: number;
                }
                const user = new User({name: 'John Doe', age: 24, weight: 72});
                expect(user.name).toEqual('John Doe');
                expect(user.age).toEqual(24);
                expect(user.weight).toEqual(72);
            });

            describe('.update()', () => {
                class User extends Item {
                    name: string;
                }

                beforeEach(() => {
                    const JOHN = {
                        $uri: '/user/1',
                        name: 'John Doe'
                    };

                    class Potion extends PotionBase {
                        protected request(uri: string, options?: RequestOptions): Promise<any> {
                            options = options || {};

                            switch (uri) {
                                case '/user/1':
                                    if (options.method === 'PATCH') {
                                        Object.assign(JOHN, {}, options.body);
                                    }

                                    return Promise.resolve({body: JOHN});
                                default:
                                    break;
                            }

                            return Promise.resolve({});
                        }
                    }

                    const potion = new Potion();
                    potion.register('/user', User);
                });

                it('should update the Item', async () => {
                    const user = await User.fetch<User>(1);
                    expect(user.name).toEqual('John Doe');

                    const name = 'John Foo Doe';
                    await user.update({name});

                    const updatedUser = await User.fetch<User>(1);
                    expect(updatedUser.name).toEqual(name);
                });
            });

            describe('.destroy()', () => {
                class User extends Item {
                    name: string;
                }

                beforeEach(() => {
                    let john: any = {
                        $uri: '/user/1',
                        name: 'John Doe'
                    };

                    class Potion extends PotionBase {
                        protected request(_: string, options?: RequestOptions): Promise<any> {
                            options = options || {};

                            switch (options.method) {
                                case 'GET':
                                    if (john) {
                                        return Promise.resolve({body: john});
                                    }
                                    return Promise.reject({});
                                case 'DELETE':
                                    john = null;
                                    return Promise.resolve({});
                                default:
                                    break;
                            }

                            return Promise.resolve({});
                        }
                    }

                    const potion = new Potion();
                    potion.register('/user', User);
                });

                it('should destroy the Item', async () => {
                    const success = jasmine.createSpy('success');
                    const error = jasmine.createSpy('error');

                    const user = await User.fetch<User>(3);
                    await user.destroy();

                    try {
                        await User.fetch(3);
                        success();
                    } catch (err) {
                        error(err);
                    }

                    expect(success).not.toHaveBeenCalled();
                    expect(error).toHaveBeenCalled();
                });
            });

            describe('.save()', () => {
                class User extends Item {
                    name: string;
                }

                beforeEach(() => {
                    let john: any = null;

                    class Potion extends PotionBase {
                        protected request(_: string, options?: RequestOptions): Promise<any> {
                            options = options || {};

                            switch (options.method) {
                                case 'POST':
                                    john = {...options.body, $uri: '/user/4'};
                                    return Promise.resolve(john);
                                case 'PATCH':
                                    Object.assign(john, options.body, {$uri: '/user/4'});
                                    return Promise.resolve(john);
                                case 'GET':
                                    return Promise.resolve({body: john});
                                default:
                                    break;
                            }

                            return Promise.resolve({});
                        }
                    }

                    const potion = new Potion();
                    potion.register('/user', User);
                });

                it('should save the Item', async () => {
                    const name = 'Foo Bar';

                    const rawUser = new User({name});
                    await rawUser.save();
                    const user = await User.fetch<User>(4);

                    expect(user.id).toEqual(4);
                    expect(user.name).toEqual(name);
                });

                it('should update the Item if it exists', async () => {
                    const name = 'Foo Bar';
                    const newName = 'John Doe';

                    const rawUser = new User({name});
                    await rawUser.save();

                    const userBeforeSave = await User.fetch<User>(4);
                    expect(userBeforeSave.name).toEqual(name);
                    userBeforeSave.name = newName;
                    await userBeforeSave.save();

                    const userAfterSave = await User.fetch<User>(4);
                    expect(userAfterSave.id).toEqual(4);
                    expect(userAfterSave.name).toEqual(newName);
                });
            });

            describe('.toJSON()', () => {
                class User extends Item {
                    name: string;
                    weight: number;

                    @readonly
                    age: number;

                    @async
                    ping: Promise<string>;
                }

                let user: User;

                beforeEach(() => {
                    class Potion extends PotionBase {
                        protected request(): Promise<any> {
                            return Promise.resolve({});
                        }
                    }

                    const potion = new Potion();
                    potion.register('/user', User, {
                        readonly: ['weight']
                    });

                    user = new User({name: 'John Doe', age: 24, weight: 72});
                });

                it('should return a JSON repr. of the Item without prohibited properties', () => {
                    const {name, id, potion} = user.toJSON();
                    expect(name).toEqual('John Doe');
                    expect(id).toBeUndefined();
                    expect(potion).toBeUndefined();
                });

                it('should omit @readonly properties', () => {
                    const {age, weight} = user.toJSON();
                    expect(age).toBeUndefined();
                    expect(weight).toBeUndefined();
                });

                it('should omit @async properties', () => {
                    const {ping} = user.toJSON();
                    expect(ping).toBeUndefined();
                });
            });

            describe('.equals()', () => {
                class User extends Item {}
                class Engine extends Item {}

                beforeEach(() => {
                    class Potion extends PotionBase {
                        protected request(uri: string): Promise<any> {
                            switch (uri) {
                                case '/user/1':
                                    return Promise.resolve({
                                        body: {$uri: '/user/1'}
                                    });
                                case '/user/2':
                                    return Promise.resolve({
                                        body: {$uri: '/user/2'}
                                    });
                                case '/engine/1':
                                    return Promise.resolve({
                                        body: {$uri: '/engine/1'}
                                    });
                                default:
                                    break;
                            }

                            return Promise.resolve({});
                        }
                    }

                    const potion = new Potion();
                    potion.register('/user', User);
                    potion.register('/engine', Engine);
                });

                it('should check if the current resource is the same as the one compared with', async () => {
                    const [john, jane, engine] = await Promise.all([User.fetch(1), User.fetch(2), Engine.fetch(1)]);
                    expect(john.equals(jane)).toBeFalsy();
                    expect(john.equals(engine)).toBeFalsy();
                    expect(john.equals(john)).toBeTruthy();
                });
            });
        });
    });
});


function toPages(items: any[], perPage: number): any[][] {
    const pages: any[][] = [];
    let i;
    for (i = 0; i < items.length; i += perPage) {
        pages.push(items.slice(i, i + perPage));
    }
    return pages;
}
