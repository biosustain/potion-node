#!/usr/bin/env bash
# Exit on first occurence of an error
set -e


# Build all the bundles (AngularJS, Fetch and Angular 4+)
./scripts/build_angularjs.sh
./scripts/build_fetch.sh
./scripts/build_ng.sh
