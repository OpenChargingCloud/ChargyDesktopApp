#!/bin/bash

if [ ! -f $1 ]; then
	echo "File '$1' not found!";
	exit 1;
fi

if [ ! -f $2 ]; then
	echo "File '$2' not found!";
	exit 2;
fi

if [ ! -z "$1" ] && [ ! -z "$2" ]; then
	echo "'$1' -> '$1.sign' using private key file '$2'"
	openssl dgst -sha256 -sign $2 $1 > $1.sign
else
	echo "Usage: ./sign.sh [plaintext file] [private key file]"
	exit 3;
fi
