#!/bin/bash

#openssl ecparam -list_curves

echo "Generating a private/public key for $1 using SECG secp256r1/ANSI prime256v1/NIST P-256"
openssl ecparam -name secp256r1 -out $1-parameters.pem
openssl ecparam -in $1-parameters.pem -text -param_enc explicit -noout
openssl ecparam -name secp256r1 -genkey -noout -out $1-privateKey.pem
openssl ec -in $1-privateKey.pem -text -noout
openssl ec -in $1-privateKey.pem -pubout -out $1-publicKey.pem
