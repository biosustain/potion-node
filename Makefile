NPM_DIR = ./lib

usage:
	@echo "Available Commands: \n \
		lint               Run code linting\n \
		test               Run code linting and unit tests\n \
		build              Compile source code\n \
		copy               Copy NPM package files (LICENSE, README.md and package.json)\n \
		publish            Publish to npm\n \
		"

# Lint all .ts files
lint:
	npm run lint
# Run tests
test: lint
	npm test

# Build everything
build:
	npm run build

# Copy npm package file, LICENSE and README
# package.json
# LICENSE
# README.md
copy:
	cp ./package.json ${NPM_DIR}
	cp ./LICENSE ${NPM_DIR}
	cp ./README.md ${NPM_DIR}

# Publish to NPM
publish: test build copy
	npm publish ${NPM_DIR}
