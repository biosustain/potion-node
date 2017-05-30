#!/usr/bin/env bash

# Use a different dist folder
NPM_DIR=./lib/

# 1. Build artifacts
# NOTE: This makes sure build errors are caught before incrementing and committing version
npm run build

# 2. Update package version, tag and commit
npm version $1 -m "Release %s"

# 3. Copy npm package file, LICENSE and README to dist folder
cp ./package.json ${NPM_DIR}
cp ./LICENSE ${NPM_DIR}
cp ./README.md ${NPM_DIR}

# 4. Publish package
# NOTE: We publish to next tag if we are in branch next
TAG=$(git rev-parse --abbrev-ref HEAD)

if [ "${TAG}" = "next" ]; then
    npm publish ${NPM_DIR} --tag next
else
    npm publish ${NPM_DIR}
fi
