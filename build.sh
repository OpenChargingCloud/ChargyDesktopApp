#!/bin/bash

#tsc -p tsconfig.json
sass src/css/chargy.scss src/css/chargy.css
webpack -c webpack.config.cjs

electron-builder
