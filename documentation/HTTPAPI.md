# Chargy Transparency HTTP API

If you want to use the Chargy HTTP API you can use e.g. curl:

```
curl -v --data        "@chargeIT-Testdatensatz-01.chargy" http://127.0.0.1:8080
"Valid signature"

curl -v --data-binary "@chargeIT-Testdatensatz-02.zip"    http://127.0.0.1:8080
"Valid signature"

curl -v --data-binary "@chargeIT-Testdatensatz-01+02.zip" http://127.0.0.1:8080
["Valid signature","Valid signature"]
```
