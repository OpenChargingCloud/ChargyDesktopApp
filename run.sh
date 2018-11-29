#!/bin/bash

tsc src/js/verifyInterfaces.ts
tsc src/js/verifyLib.ts
tsc src/js/verify.ts
#tsc src/main.ts
sass src/css/verify.scss src/css/verify.css
npm start
