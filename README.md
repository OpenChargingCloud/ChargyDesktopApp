# Chargy Desktop App

Chargy is a transparency software for secure and transparent e-mobility charging processes, as defined by the German "Eichrecht". The software allows you to verify the cryptographic signatures of energy measurements within charge detail records and comes with a couple of useful extentions to simplify the entire process for endusers and operators.


## Compiling from source
This application is based on [Electron](https://github.com/electron-userland/electron-forge/tree/5.x), a cross platform Open Source framework for creating native applications with web technologies like Java-/TypeScript, HTML, and (S)CSS.    

Chargy is developed for and tested on the following operating systems:

 - Microsoft Windows 10+
 - Apple Mac OS X
 - Linux Debian/Ubuntu

The Chargy Desktop project has a sister project called [Chargy Mobile](https://github.com/OpenChargingCloud/ChargyMobileApp) which provides the same features, but is based on Apache Cordova and is available for the following operating systems:

 - Apple iOS
 - Google Android
 - Windows Mobile


### System Requirements

Install nodejs on your system. For more details please check https://nodejs.org    
On Linux and Mac OS X:

```
sudo curl -sL https://deb.nodesource.com/setup_11.x | sudo -E bash -
sudo apt install nodejs

$ sudo npm install -g electron-forge@latest
+ electron-forge@5.2.4
added 594 packages from 397 contributors in 57.986s

$ sudo npm install -g typescript@latest
+ typescript@3.3.3333
added 1 package from 1 contributor in 1.738s

$ sudo npm install -g sass@latest
+ sass@1.17.2
added 135 packages from 106 contributors in 9.64s
```


### Get the latest version

Clone the github repository for the latest version of chargy and install
its nodejs dependencies:
```
git clone https://github.com/OpenChargingCloud/ChargyDesktopApp.git
cd ChargyDesktopApp
npm install
chmod +x run.sh
./run.sh
```


### Building a Windows Installer

The Windows version can only be build on a Windows machine and uses [Squirrel](https://github.com/Squirrel/Squirrel.Windows) as an installation and update framework.
```
electron-forge make
```


### Building a Linux package

On a Debian GNU/Linux or Ubuntu machine you can run the following commands to create a Debian software package. More information about this process can be found at: https://github.com/electron-userland/electron-installer-debian
```
sudo apt install debootstrap
electron-forge make
```

Now you can use the normal package management tools of your Linux distribution to install the app:
```
cd out/make
sudo dpkg -i chargyapp_X.Y.Z_amd64.deb
```


### Building a Linux Live ISO Image

For special users like the [Physikalisch-Technische Bundesanstalt](https://www.ptb.de) Chargy is also available as a Linux Live CD/DVD. The creation of the ISO image is described in the following document [linux-live-image](https://github.com/OpenChargingCloud/ChargyDesktopApp/blob/master/linux-live-image.md).
