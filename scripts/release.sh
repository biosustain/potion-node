#!/usr/bin/env bash

# Use a different dist folder
NPM_DIR=./lib/

# 1. Update package version, tag and commit
npm version $1 -m "Release %s"

# 2. Build artifacts
npm run build

# 3. Copy npm package file, LICENSE and README to dist folder
cp ./package.json ${NPM_DIR}
cp ./LICENSE ${NPM_DIR}
cp ./README.md ${NPM_DIR}

# 4. Publish package
npm publish ${NPM_DIR}
