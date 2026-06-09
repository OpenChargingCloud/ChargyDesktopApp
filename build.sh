#!/bin/bash

# https://github.com/Automattic/node-canvas/issues/2375
rm node_modules/canvas -rf

npm run build
