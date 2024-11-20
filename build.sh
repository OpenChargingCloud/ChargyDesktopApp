#!/bin/bash

# https://github.com/Automattic/node-canvas/issues/2375
rm node_modules/canvas -rf

npm run sbom
#tsc -p tsconfig.json
sass src/css/chargy.scss src/css/chargy.css
webpack -c webpack.config.cjs

electron-builder
