#!/bin/bash

#npm install -g electron
#npm install -g electron-forge
#npm install -g sass

tsc src/js/verifyInterfaces.ts
tsc src/js/verifyLib.ts
tsc src/js/GDFCrypt01.ts
tsc src/js/verify.ts
#tsc src/main.ts

sass src/css/verify.scss src/css/verify.css

npm start
