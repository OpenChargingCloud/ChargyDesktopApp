#!/bin/bash

echo "Trying to verify $1 via signature $1.sign and public key file $2"
openssl dgst -sha256 -verify $2 -signature $1.sign $1
