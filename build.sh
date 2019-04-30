#!/bin/bash

tsc src/js/certificates.ts
tsc src/js/chargyInterfaces.ts
tsc src/js/chargyLib.ts
tsc src/js/GDFCrypt01.ts
tsc src/js/chargy.ts

sass src/css/chargy.scss src/css/chargy.css

electron-builder
