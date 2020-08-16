# Chargy Transparency HTTP API

Chargy comes with an optional HTTP API to simplify the interaction with other software on your own computer or within a computer network.

## Starting the HTTP API

The HTTP API can be started by adding the "--http" command line parameter when starting chargy. As the HTTP API is part of the Electron render process you will currently need to run the application in its normal mode. The CLI mode is currently not supported.
```
./run.sh --http
```

Chargy will start the HTTP API on port 8080. If you want to attach it to another TCP/IP port then you can use the following command line parameter.
```
./run.sh --http=8081
```

## Verification of transparency records

If you want to use the Chargy HTTP API for validating charge transparency records you can use the following HTTP requests:
```
curl -v --data        "@documentation/chargeIT/chargeIT-Testdatensatz-01.chargy" http://127.0.0.1:8080/verify
"Valid signature"

curl -v --data-binary "@documentation/chargeIT/chargeIT-Testdatensatz-02.zip"    http://127.0.0.1:8080/verify
"Valid signature"

curl -v --data-binary "@documentation/chargeIT/chargeIT-Testdatensatz-01+02.zip" http://127.0.0.1:8080/verify
["Valid signature","Valid signature"]
```

## Conversion of transparency records

If you want to validate Chargy or just like to convert your charge transparency records in a more user-friendly pure JSON format you can use the following HTTP requests:
```
curl -v --data        "@documentation/chargeIT/chargeIT-Testdatensatz-01.chargy" http://127.0.0.1:8080/convert
{ ... }
```

You can also retrieve a pretty-printed JSON via the following HTTP request:
```
curl -v --data-binary "@documentation/chargeIT/chargeIT-Testdatensatz-01+02.zip" http://127.0.0.1:8080/convert?pretty
{ ... }
```
