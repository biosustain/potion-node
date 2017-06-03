#!/usr/bin/env bash
COMPILATION_DIR="./out-tsc"
LIB_NAME="angularjs"
ES5_OUTFILE="${COMPILATION_DIR}/angularjs-es5/${LIB_NAME}.js"
ES2015_OUTPUT_DIR="${COMPILATION_DIR}/angularjs-es2015"

DIST_DIR="./dist"
DIST_FILENAME="${DIST_DIR}/${LIB_NAME}"


# Build ES2015
$(npm bin)/tsc -p src/tsconfig.angularjs.json --outDir ${ES2015_OUTPUT_DIR} --target ES2015
# Rollup ES2015 FESM
$(npm bin)/rollup -c config/rollup.config.js\
    -i "${ES2015_OUTPUT_DIR}/${LIB_NAME}.js"\
    -o "${DIST_FILENAME}.js"\
    --format es

# Copy type definition file to dist
cp "${ES2015_OUTPUT_DIR}/${LIB_NAME}.d.ts" ${DIST_DIR}

# Build ES5
$(npm bin)/tsc -p src/tsconfig.angularjs.json
# Rollup ES5 FESM, UMD
$(npm bin)/rollup -c config/rollup.config.js\
    -i "${ES5_OUTFILE}"\
    -o "${DIST_FILENAME}.umd.min.js"\
    --format umd\
    --environment UGLIFY

$(npm bin)/rollup -c config/rollup.config.js\
    -i "${ES5_OUTFILE}"\
    -o "${DIST_FILENAME}.umd.js"\
    --format umd

$(npm bin)/rollup -c config/rollup.config.js\
    -i "${ES5_OUTFILE}"\
    -o "${DIST_FILENAME}.es5.js"\
    --format es
