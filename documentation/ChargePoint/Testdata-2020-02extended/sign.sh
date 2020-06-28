#!/bin/bash

if [ -f $1 ]; then
	echo "Usage: ./sign.sh [plaintext] [privatekey]"
	exit 1
fi

echo "$1 -> $1.sign using private key file $2"
openssl dgst -sha256 -sign $2 $1 > $1.sign
