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
+ typescript@3.7.2

$ npm install sass@latest --save-dev
+ sass@1.23.6

$ npm install @types/node@latest --save-dev
+ @types/node@12.12.8

$ npm install elliptic@latest
+ elliptic@6.5.1

$ npm install @types/elliptic@latest --save-dev
+ @types/elliptic@6.4.10

$ npm install key-encoder@latest
+ key-encoder@2.0.3

$ npm install asn1.js@latest
+ asn1.js@5.2.0

$ npm install moment@latest
+ moment@2.24.0

$ npm install base32-decode
+ base32-decode@1.0.0

$ npm install file-type@latest
+ file-type@12.4.0

$ npm install decompress@latest
+ decompress@4.2.0

$ npm install @types/decompress --save-dev
+ @types/decompress@4.2.3

$ npm install decompress-tarxz@latest
+ decompress-tarxz@3.0.0

$ npm install decompress-bzip2@latest
+ decompress-bzip2@4.0.0

$ npm install decompress-gz@latest
+ decompress-gz@0.0.1

$ npm install chart.js@latest
+ chart.js@2.9.3

$ npm install @types/chart.js@latest --save-dev
+ @types/chart.js@2.9.0

$ npm install electron-localshortcut --save
+ electron-localshortcut@3.2.1
```



# Verify SHA512 hash values
```
openssl dgst -sha512 -binary Chargy\ Transparenz\ Software\ Setup\ 0.26.0.exe | base64
    => oWo3Lxom0clRi8wWXbJ/fheyrYDOftGgE+KKrB8On41v3Wtbtp1/4+LacmJiY1q0eUT9SDP9OMy5HZGd8pwGgg==
```
