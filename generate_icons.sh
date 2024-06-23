#!/bin/bash

# sudo apt-get install imagemagick
# Verification: https://redketchup.io/icon-editor
rm src/icons/chargy_shield3.ico -rf
convert src/icons/chargy_shield3/chargy_shield3_16x16.png \
        src/icons/chargy_shield3/chargy_shield3_32x32.png \
        src/icons/chargy_shield3/chargy_shield3_48x48.png \
        src/icons/chargy_shield3/chargy_shield3_64x64.png \
        src/icons/chargy_shield3/chargy_shield3_128x128.png \
        src/icons/chargy_shield3/chargy_shield3_256x256.png \
        src/icons/chargy_shield3/chargy_shield3_512x512.png \
        src/icons/chargy_shield3.ico
