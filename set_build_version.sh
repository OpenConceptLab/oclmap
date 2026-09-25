#!/bin/bash
#Sets project build version
set -e

CONFIG_FILE="config.json"
touch ${CONFIG_FILE}

SHA=$(./release_version.sh sha "${SOURCE_COMMIT:-}")

echo "Setting build version to $SHA in ${CONFIG_FILE}"

echo "{ \"build\": \"$SHA\" }" > ${CONFIG_FILE}

