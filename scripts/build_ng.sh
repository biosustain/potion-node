#!/usr/bin/env bash
COMPILATION_DIR="./out-tsc"
LIB_NAME="ng"
ES5_OUTFILE="${COMPILATION_DIR}/ng-es5/${LIB_NAME}.js"
ES2015_OUTPUT_DIR="${COMPILATION_DIR}/ng-es2015"

DIST_DIR="./dist"
DIST_FILENAME="${DIST_DIR}/${LIB_NAME}"


# Build ES2015
$(npm bin)/ngc -p src/tsconfig.json
# Rollup ES2015 FESM
$(npm bin)/rollup -c ./rollup.config.js\
    -i "${ES2015_OUTPUT_DIR}/${LIB_NAME}.js"\
    -o "${DIST_FILENAME}.js"\
    --format es

# Copy type definition files to dist
rsync -a --include="*/" --include '*.d.ts' --include '*.metadata.json' --exclude '*' ${ES2015_OUTPUT_DIR}/ ${DIST_DIR}

# Build ES5
$(npm bin)/ngc -p src/tsconfig.es5.json
# # Rollup ES5 FESM, UMD
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
