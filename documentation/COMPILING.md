# Compiling from Source

This application is based on [Electron](https://github.com/electron-userland/electron-forge/tree/5.x), a cross platform Open Source framework for creating native applications with web technologies like Java-/TypeScript, HTML, and (S)CSS.    

Chargy is developed for and tested on the following operating systems:

 - Microsoft Windows 10+
 - Apple Mac OS X
 - Linux Debian/Ubuntu

The Chargy Desktop project has a sister project called [Chargy Mobile](https://github.com/OpenChargingCloud/ChargyMobileApp) which provides the same features, but is based on [Apache Cordova](https://cordova.apache.org) and is available for the following operating systems:

 - Apple iOS
 - Google Android


## System Requirements

You can download node.js 12.5.0 with npm 6.9.2 for Microsoft Windows or Mac OS X from https://nodejs.org/en/download/current/    
Please note, that you have to reinstall this software for every update.    

On Linux you can install Node.js via...
```
sudo apt install git curl
sudo curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt install -y nodejs
```

Or when you want to update a previous Linux installation update Node.js and npm via...
```
sudo npm cache clean -f
sudo npm install -g n
sudo n latest

sudo npm install -g npm
```

Afterwards you can install the remaining software using the node packet manager
```
$ sudo npm install -g electron@latest
+ electron@5.0.6
(If this fails on Linux try: sudo npm install -g electron --unsafe-perm=true --allow-root)

$ sudo npm install -g electron-builder@latest
+ electron-builder@20.44.4

$ sudo npm install -g typescript@latest
+ typescript@3.9.7

$ sudo npm install -g sass@latest
+ sass@1.26.10
```


## Get the latest version

Clone the github repository for the latest version of chargy and install
its nodejs dependencies:
```
git clone https://github.com/OpenChargingCloud/ChargyDesktopApp.git
cd ChargyDesktopApp
npm install
```
Now you can test the software via...
```
./run.sh
```

**Please be aware**, that Electron comes with its own internal version of Node.js. This version is currently still 12.0.0. Therefore Chargy will also show "12.0.0" and not the version number of the Node.js installation on your computer, e.g. "12.4.0". It is possible to rebuild the internal Node.js version, but we do not recommend this.


## Building a Windows Installer

The Windows version can only be build on a Windows machine and uses [NSIS](https://www.electron.build/configuration/nsis) as an installation framework.
```
./build.sh
```
The resulting installer is located at...
```
~/dist/Chargy Transparenz Software Setup x.y.z.exe
```


## Building a Linux package

On a Debian GNU/Linux or Ubuntu machine you can run the following commands to create a Debian software package. More information about this process can be found at: https://github.com/electron-userland/electron-installer-debian
```
sudo apt install debootstrap binutils
./build.sh
```

Now you can use the normal package management tools of your Linux distribution to install the app:
```
cd dist
sudo apt install ./chargytransparenzsoftware_X.Y.Z_amd64.deb
```


## Building a Linux Live DVD / ISO Image

For special users like the [Physikalisch-Technische Bundesanstalt](https://www.ptb.de) Chargy is also available as a Linux Live CD/DVD. The creation of the ISO image is described in the following document [Linux Live DVD](https://github.com/OpenChargingCloud/ChargyDesktopApp/blob/master/documentation/LinuxLiveDVD.md).
