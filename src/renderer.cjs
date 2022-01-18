// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

const fs    = require('original-fs')
const path  = require('path');
const crypt = require('crypto');

// const root1 = fs.readdirSync('.')
// console.log(root1)

// const root2 = fs.readdirSync('./resources')
// console.log(root2)



