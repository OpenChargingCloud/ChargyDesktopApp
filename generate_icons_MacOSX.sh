#!/bin/bash

rm src/icons/chargy_shield3.iconset -rf
mkdir src/icons/chargy_shield3.iconset

cp src/icons/chargy_shield3/chargy_shield3_16x16.png chargy_shield3.iconset/icon_16x16.png
cp src/icons/chargy_shield3/chargy_shield3_32x32.png chargy_shield3.iconset/icon_16x16@2x.png

cp src/icons/chargy_shield3/chargy_shield3_32x32.png chargy_shield3.iconset/icon_32x32.png
cp src/icons/chargy_shield3/chargy_shield3_64x64.png chargy_shield3.iconset/icon_32x32@2x.png

cp src/icons/chargy_shield3/chargy_shield3_128x128.png chargy_shield3.iconset/icon_128x128.png
cp src/icons/chargy_shield3/chargy_shield3_256x256.png chargy_shield3.iconset/icon_128x128@2x.png

cp src/icons/chargy_shield3/chargy_shield3_256x256.png chargy_shield3.iconset/icon_256x256.png
cp src/icons/chargy_shield3/chargy_shield3_512x512.png chargy_shield3.iconset/icon_256x256@2x.png

cp src/icons/chargy_shield3/chargy_shield3_512x512.png chargy_shield3.iconset/icon_512x512.png
cp src/icons/chargy_shield3/chargy_shield3_1024x1024.png chargy_shield3.iconset/icon_512x512@2x.png

iconutil -c icns chargy_shield2.iconset
