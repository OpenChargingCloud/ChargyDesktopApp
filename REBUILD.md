# Rebuilding the Chargy Desktop App

```
$ npm install electron-builder -g --save-dev
+ electron-builder@20.39.0
```

# Build the app
```
electron-builder
```

# Verify the SHA512 hash value
```
openssl dgst -sha512 -binary Chargy\ Transparenz\ Software\ Setup\ 0.26.0.exe | base64
    => oWo3Lxom0clRi8wWXbJ/fheyrYDOftGgE+KKrB8On41v3Wtbtp1/4+LacmJiY1q0eUT9SDP9OMy5HZGd8pwGgg==
```
