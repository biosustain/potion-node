# Potion

[![Build Status](https://img.shields.io/travis/biosustain/potion-node.svg?style=flat-square)](https://travis-ci.org/biosustain/potion-node)
[![Dependency Status](https://david-dm.org/biosustain/potion-node.svg?style=flat-square)](https://github.com/biosustain/potion-node)

> A TypeScript client for APIs written in Flask-Potion.


# Table of Contents

* [Installation](#installation)
* [Usage](#usage)
    * [API](docs/API.md)
    * [Angular](docs/ANGULAR.md)
    * [AngularJS](docs/ANGULARJS.md)
    * [Fetch](docs/FETCH.md)
* [Contribute](#contribute)


### Installation
----------------
Install this package with [NPM](https://www.npmjs.com):
```shell
$(node bin)/npm install potion-client
```

Or [Yarn](https://yarnpkg.com/en):
```shell
yarn install potion-client
```

It can also be used with [JSPM](http://jspm.io):
```shell
$(npm bin)/jspm install potion=npm:potion-client
```


### Usage
---------
Before you use this package, make sure you include [reflect-metadata](https://www.npmjs.com/package/reflect-metadata) and a shim for ES6/7 features ([core-js](https://github.com/zloirock/core-js) has the most comprehensive collection of shims and I advise using it).

Furthermore, this package has multiple implementations available, it can be used with:
* [Fetch](docs/FETCH.md), using [Fetch API](https://developer.mozilla.org/en/docs/Web/API/Fetch_API) (make sure to include a polyfill such as [whatwg-fetch](https://github.com/github/fetch) if you are targeting a browser that does not implement the API);
* [Angular](docs/ANGULAR.md);
* [AngularJS](docs/ANGULARJS.md).

**IMPORTANT**: All resource properties that are retrieved from the backend will be converted from snake case to camel case, so the following:
```python
class Foo(db.Model):
    bar_name = db.Column(db.String(256), nullable=True)
```
Will match the following resource on the client side:
```ts
class Foo extends Item {
    barName: string;
}
```


### Contribute
----------------
If you'd like to contribute:
1. Clone the repository `git clone https://github.com/biosustain/potion-node`;
2. Install all the deps `yarn install`/`npm install`. 

Now you can start hacking :)

Before you make a pull request, make sure that the builds and tests will run successfully:
1. Run the tests using `npm run test` (*if you wish to run tests on file change, use `npm run test:continuous`*);
2. Lint the code with `npm run lint`;
3. Use `npm run build` to build the `.ts` files and see if any errors have occurred.

If you're a contributor and you wish to publish the package,
make sure you update the package version in `package.json` according to the [semver](http://semver.org/) spec and:
```shell
make publish
```
