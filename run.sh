#!/bin/bash

#npm install -g electron
#npm install -g electron-forge
#npm install -g sass

tsc src/js/chargyInterfaces.ts
tsc src/js/chargyLib.ts
tsc src/js/GDFCrypt01.ts
tsc src/js/chargy.ts
#tsc src/main.ts

sass src/css/chargy.scss src/css/chargy.css

npm start
