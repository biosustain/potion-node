#!/bin/bash
set -ex

ROOT_DIR=$(cd $(dirname $0)/..; pwd)
cd ${ROOT_DIR}

# Cleanup any previous dist artifacts
npm run clean

# Run tests
npm run lint
npm test

# Build dist
npm run build

NPM_DIR=${ROOT_DIR}/dist

# Copy npm package manifest, license and readme
cp ./package.json ${NPM_DIR}
cp ./LICENSE ${NPM_DIR}
cp ./README.md ${NPM_DIR}

# Publish to npm
npm publish ${NPM_DIR}
