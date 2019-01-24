# Chargy Desktop App
## Transparency Software for a secure and transparent E-Mobility Charging processes

### Technology
This application is based on Electron https://github.com/electron-userland/electron-forge/tree/5.x, a cross platform Open Source framework for creating native applications with web technologies like Java-/TypeScript, HTML, and (S)CSS.    

Chargy is developed for and tested on the following operating systems

 - Microsoft Windows 10+
 - Apple Mac OS X
 - Linux Debian/Ubuntu


### System Requirements

Install nodejs on your system. For more details please check https://nodejs.org    
On Linux and Mac OS X:

```
$ curl -sL https://deb.nodesource.com/setup_11.x | sudo -E bash -
$ apt install nodejs

$ npm install -g electron-forge
$ npm install -g typescript
$ npm install -g sass
```


### Get the latest version

Clone the github repository for the latest version of chargy and install
its nodejs dependencies:
```
$ git clone git@github.com:OpenChargingCloud/ChargyDesktopApp.git
$ cd ChargyDesktopApp
$ npm install
$ chmod +x run.sh
$ ./run.sh
```


### Building a Windows Installer

```
$ electron-forge make
```


### Building a Linux package

On Debian GNU/Linux and Ubuntu you can run the following commands to create a Debian software package.
```
$ sudo apt install debootstrap
$ electron-forge make
```

Now you can use the normal package management tools of your Linux distribution to install the app.
```
$ apt install out/make/chargyapp_X.Y.Z_amd64.deb
```


### Building a Linux Live ISO Image

For sepcial users like the  chargy is also available as a Linux Live CD/DVD. The creation of the ISO iamge is described in the following document [linux-live-image.md](https://github.com/OpenChargingCloud/ChargyDesktopApp/blob/master/linux-live-image.md)
