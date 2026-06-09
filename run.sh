#!/bin/bash

npm run bundle
npm start --silent -- --inspect "$@"
