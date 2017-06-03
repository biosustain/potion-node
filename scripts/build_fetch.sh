#!/usr/bin/env bash
COMPILATION_DIR="./out-tsc"
LIB_NAME="fetch"
ES5_OUTFILE="${COMPILATION_DIR}/fetch-es5/${LIB_NAME}.js"
ES2015_OUTPUT_DIR="${COMPILATION_DIR}/fetch-es2015"

DIST_DIR="./dist"
DIST_FILENAME="${DIST_DIR}/${LIB_NAME}"


# Build ES2015
$(npm bin)/tsc -p src/tsconfig.fetch.json --outDir ${ES2015_OUTPUT_DIR} --target ES2015
# Rollup ES2015 FESM
$(npm bin)/rollup -c ./rollup.config.js\
    -i "${ES2015_OUTPUT_DIR}/${LIB_NAME}.js"\
    -o "${DIST_FILENAME}.js"\
    --format es

# Copy type definition file to dist
cp "${ES2015_OUTPUT_DIR}/${LIB_NAME}.d.ts" ${DIST_DIR}

# Build ES5
$(npm bin)/tsc -p src/tsconfig.fetch.json
# Rollup ES5 FESM, UMD
$(npm bin)/rollup -c ./rollup.config.js\
    -i "${ES5_OUTFILE}"\
    -o "${DIST_FILENAME}.umd.min.js"\
    --format umd\
    --environment UGLIFY

$(npm bin)/rollup -c ./rollup.config.js\
    -i "${ES5_OUTFILE}"\
    -o "${DIST_FILENAME}.umd.js"\
    --format umd

$(npm bin)/rollup -c ./rollup.config.js\
    -i "${ES5_OUTFILE}"\
    -o "${DIST_FILENAME}.es5.js"\
    --format es
