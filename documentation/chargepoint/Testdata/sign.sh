#!/bin/bash

echo "$1 -> $1.sign using private key file $2"
openssl dgst -sha256 -sign $2 $1 > $1.sign
