# Chargy Desktop App
## Transparenzsoftware für die Elektromobilität

### Technologie
Based on Electron https://github.com/electron-userland/electron-forge/tree/5.x    

### Zielplattformen
 - Microsoft Windows
 - Apple Mac OS X
 - Linux

### System Requirements

Install nodejs on your system. For more details please check https://nodejs.org    
On Linux and Mac OS X:

´´´
$ curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
$ apt install nodejs

$ npm install -g electron-forge
$ npm install -g typescript
$ npm install -g sass
´´´

### Get the latest version

Clone the github repository for the latest version of chargy and install
its nodejs dependencies:
´´´
$ git clone git@github.com:OpenChargingCloud/ChargyDesktopApp.git
$ cd ChargyDesktopApp
$ npm install
$ chmod +x run.sh
$ ./run.sh
´´´

### Building a Windows Installer

´´´
$ electron-forge make
´´´


### Building a Linux package

´´´
$ sudo apt install debootstrap
$ electron-forge make
´´´

