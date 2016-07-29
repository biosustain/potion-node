NPM_DIR = ./dist

usage:
	@echo "Available Commands: \n \
		clean              Cleanup the dist files\n \
		test               Run code linting and unit tests\n \
		build              Compile source code\n \
		copy               Copy NPM package files (LICENSE, README.md and package.json)\n \
		publish            Publish to npm\n \
		"

# Cleanup
clean:
	npm run clean

# Run tests
test:
	npm run lint
	npm test

# Build everything
build:
	npm run build

# Copy npm package file
# LICENSE
# README.md
# package.json
copy:
	cp ./package.json ${NPM_DIR}
	cp ./LICENSE ${NPM_DIR}
	cp ./README.md ${NPM_DIR}

# Publish to NPM
publish: clean test build copy
	npm publish
