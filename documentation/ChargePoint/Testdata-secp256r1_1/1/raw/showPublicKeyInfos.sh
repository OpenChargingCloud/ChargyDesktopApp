#!/bin/bash

openssl pkey -inform PEM -pubin -in $1 -text -noout
