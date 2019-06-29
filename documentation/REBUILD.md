# Rebuilding the Chargy Desktop App

## Download latest Electron Example
```
git clone https://github.com/electron/electron-quick-start
cd electron-quick-start
npm install
```

## Install additional Node modules
```
$ npm install electron@latest --save-dev
+ electron@5.0.6

$ npm install electron-builder@latest --save-dev
+ electron-builder@20.44.4

$ npm install typescript@latest --save-dev
+ typescript@3.5.2

$ npm install sass@latest --save-dev
+ sass@1.22.1

$ npm install @types/node@latest --save-dev
+ @types/node@12.0.10

$ npm install elliptic@latest
+ elliptic@6.5.0

$ npm install @types/elliptic@latest --save-dev
+ @types/elliptic@6.4.9

$ npm install moment@latest
+ moment@2.24.0
```






# Verify SHA512 hash values
```
openssl dgst -sha512 -binary Chargy\ Transparenz\ Software\ Setup\ 0.26.0.exe | base64
    => oWo3Lxom0clRi8wWXbJ/fheyrYDOftGgE+KKrB8On41v3Wtbtp1/4+LacmJiY1q0eUT9SDP9OMy5HZGd8pwGgg==
```
