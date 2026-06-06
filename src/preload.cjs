const { contextBridge, ipcRenderer } = require('electron');

const validChannels = new Set([
    'receiveReadClipboard',
    'receiveFileToOpen',
    'receiveFilesToOpen',
    'receiveHttpRequest'
]);

contextBridge.exposeInMainWorld('chargyElectron', {

    getAppContext: () => ipcRenderer.sendSync('getAppContext'),

    showSaveDialog: () => ipcRenderer.invoke('showSaveDialog'),

    writeTextFile: (fileName, content) => ipcRenderer.invoke('writeTextFile', fileName, content),

    readFile: fileName => ipcRenderer.invoke('readFile', fileName),

    readClipboardText: () => ipcRenderer.invoke('readClipboardText'),

    readClipboardImage: () => ipcRenderer.invoke('readClipboardImage'),

    calculateApplicationHash: () => ipcRenderer.invoke('calculateApplicationHash'),

    sha256Hex: content => ipcRenderer.invoke('sha256Hex', content),

    openExternal: url => ipcRenderer.invoke('openExternal', url),

    completeHttpRequest: (requestId, result) => ipcRenderer.send('completeHttpRequest', requestId, result),

    setVerificationResult: result => ipcRenderer.sendSync('setVerificationResult', result),

    on: (channel, listener) => {
        if (!validChannels.has(channel))
            throw new Error(`Unsupported IPC channel: ${channel}`);

        const subscription = (_event, ...args) => listener(...args);
        ipcRenderer.on(channel, subscription);
        return () => ipcRenderer.removeListener(channel, subscription);
    }

});
