#!/bin/bash

#openssl ec -inform PEM -pubin -in 0024b10000027b29_1.pem -text -noout
openssl pkey -inform PEM -pubin -in $1 -text -noout
