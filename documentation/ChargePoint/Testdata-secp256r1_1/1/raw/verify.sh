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
	echo "Trying to verify $1 via signature $1.sign and public key file $2"
	openssl dgst -sha256 -verify $2 -signature $1.sign $1
else
	echo "Usage: ./verify [signature file] [public key file]"
fi
