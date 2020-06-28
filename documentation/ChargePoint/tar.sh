#!/bin/bash

echo "Compressing $1 -> $1.tar.bz2"
cd $1
tar -cjf ../$1.tar.bz2 *
cd ..
