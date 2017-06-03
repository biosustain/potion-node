#!/usr/bin/env bash

# Use a different dist folder
NPM_DIR=./dist/

# 1. Build artifacts
# NOTE: This makes sure build errors are caught before incrementing and committing version.
npm run build

# 2. Update package version
# NOTE: We don't commit and tag since we want to create the tag/commit after we generated the changelog.
# https://docs.npmjs.com/cli/version
NPM_VERSION_NAME=$(npm --no-git-tag-version version $1)
NPM_VERSION=${NPM_VERSION_NAME//[v]/}

# 3. Generate changelog
conventional-changelog -p angular -i CHANGELOG.md -s -r 0

# 4. Commit & tag
# 4.1 Commit package.json and CHANGELOG.md
# 4.2 Create a tag with version
git add package.json CHANGELOG.md
COMMIT_MESSAGE="Release ${NPM_VERSION}"
git commit -m "${COMMIT_MESSAGE}"
# Get last commit SHA (https://stackoverflow.com/a/949391/1092007)
COMMIT_SHA=$(git rev-parse --verify HEAD)
git tag -a ${NPM_VERSION_NAME} ${COMMIT_SHA} -m "${COMMIT_MESSAGE}"

# 5. Copy npm package file, LICENSE, CHANGELOG and README to dist folder
cp ./package.json ${NPM_DIR}
cp ./LICENSE ${NPM_DIR}
cp ./CHANGELOG.md ${NPM_DIR}
cp ./README.md ${NPM_DIR}

# 6. Publish package
# NOTE: We publish to next tag if we are in branch next.
# Get current branch name (https://stackoverflow.com/a/1418022/1092007)
TAG=$(git rev-parse --abbrev-ref HEAD)

if [ "${TAG}" = "next" ]; then
    npm publish ${NPM_DIR} --tag next
else
    npm publish ${NPM_DIR}
fi
