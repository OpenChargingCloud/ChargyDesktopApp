#!/bin/bash

#openssl ecparam -list_curves
openssl ecparam -name secp256k1 -out $1-parameters.pem
#openssl ecparam -in secp256k1.pem -text -param_enc explicit -noout
openssl ecparam -name secp256k1 -genkey -noout -out $1-privateKey.pem
#openssl ec -in secp256k1-privateKey.pem -text -noout
openssl ec -in $1-privateKey.pem -pubout -out $1-publicKey.pem
