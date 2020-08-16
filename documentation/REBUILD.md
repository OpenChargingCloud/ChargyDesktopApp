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
+ typescript@3.9.7

$ npm install sass@latest --save-dev
+ sass@1.26.10

$ npm install @types/node@latest --save-dev
+ @types/node@14.0.27

$ npm install elliptic@latest
+ elliptic@6.5.3

$ npm install @types/elliptic@latest --save-dev
+ @types/elliptic@6.4.12

$ npm install asn1.js@latest
+ asn1.js@5.4.1

$ npm install moment@latest
+ moment@2.27.0

$ npm install base32-decode
+ base32-decode@1.0.0

$ npm install file-type@latest
+ file-type@14.7.1

$ npm install decompress@latest
+ decompress@4.2.1

$ npm install @types/decompress --save-dev
+ @types/decompress@4.2.3

//$ npm install decompress-tarxz@latest
//+ decompress-tarxz@3.0.0

$ npm install decompress-bzip2@latest
+ decompress-bzip2@4.0.0

$ npm install decompress-gz@latest
+ decompress-gz@0.0.1

$ npm install chart.js@latest
+ chart.js@2.9.3

$ npm install @types/chart.js@latest --save-dev
+ @types/chart.js@2.9.23

$ npm install electron-localshortcut --save
+ electron-localshortcut@3.2.1

$ npm install leaflet@latest --save
+ leaflet@1.6.0

$ npm install @types/leaflet@latest --save-dev
+ @types/leaflet@1.5.17

$ npm install leaflet.awesome-markers@latest --save
+ leaflet.awesome-markers@2.0.5

$ npm install safe-stable-stringify --save
+ safe-stable-stringify@1.1.1
```



# Verify SHA512 hash values
```
openssl dgst -sha512 -binary Chargy\ Transparenz\ Software\ Setup\ 0.26.0.exe | base64
    => oWo3Lxom0clRi8wWXbJ/fheyrYDOftGgE+KKrB8On41v3Wtbtp1/4+LacmJiY1q0eUT9SDP9OMy5HZGd8pwGgg==
```
