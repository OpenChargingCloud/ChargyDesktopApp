# Rebuilding the Chargy Desktop App

## Download latest Electron Example
```
git clone https://github.com/electron/electron-quick-start
cd electron-quick-start
npm install
```

## Install additional Node.js modules
```
$ npm install electron@latest --save-dev
$ npm install electron-builder@latest --save-dev
$ npm install typescript@latest --save-dev
$ npm install sass@latest --save-dev
$ npm install @types/node@latest --save-dev
$ npm install elliptic@latest
$ npm install @types/elliptic@latest --save-dev
$ npm install asn1.js@latest
$ npm install moment@latest
$ npm install base32-decode
$ npm install file-type@latest
$ npm install decompress@latest
$ npm install @types/decompress --save-dev
//$ npm install decompress-tarxz@latest
$ npm install decompress-bzip2@latest
$ npm install decompress-gz@latest
$ npm install chart.js@latest
$ npm install @types/chart.js@latest --save-dev
$ npm install electron-localshortcut --save-dev
$ npm install leaflet@latest --save
$ npm install @types/leaflet@latest --save-dev
$ npm install leaflet.awesome-markers@latest --save
$ npm install safe-stable-stringify --save
$ npm install webpack --save-dev
$ npm install webpack-cli --save-dev
$ npm install ts-loader --save-dev
$ npm install cyclonedx/cyclonedx-npm --save-dev
```

## Updating all Node.js modules
```
$ npm update
```

Security updates
```
$ npm audit fix
```

# Verify SHA512 hash values
```
openssl dgst -sha512 -binary Chargy\ Transparenz\ Software\ Setup\ 0.26.0.exe | base64
    => oWo3Lxom0clRi8wWXbJ/fheyrYDOftGgE+KKrB8On41v3Wtbtp1/4+LacmJiY1q0eUT9SDP9OMy5HZGd8pwGgg==
```
