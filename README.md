# Chargy Desktop App

Chargy is a transparency software for secure and transparent e-mobility charging processes, as defined by the German "Eichrecht". The software allows you to verify the cryptographic signatures of energy measurements within charge detail records and comes with a couple of useful extentions to simplify the entire process for endusers and operators.


## Technology
This application is based on [Electron](https://github.com/electron-userland/electron-forge/tree/5.x), a cross platform Open Source framework for creating native applications with web technologies like Java-/TypeScript, HTML, and (S)CSS.    

Chargy is developed for and tested on the following operating systems

 - Microsoft Windows 10+
 - Apple Mac OS X
 - Linux Debian/Ubuntu


### System Requirements

Install nodejs on your system. For more details please check https://nodejs.org    
On Linux and Mac OS X:

```
sudo curl -sL https://deb.nodesource.com/setup_11.x | sudo -E bash -
sudo apt install nodejs

sudo npm install -g electron-forge
sudo npm install -g typescript
sudo npm install -g sass
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

```
electron-forge make
```


### Building a Linux package

On Debian GNU/Linux and Ubuntu you can run the following commands to create a Debian software package. More information about this process can be found at: https://github.com/electron-userland/electron-installer-debian
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

For special users like the [Physikalisch-Technische Bundesanstalt](https://www.ptb.de) chargy is also available as a Linux Live CD/DVD. The creation of the ISO image is described in the following document [linux-live-image](https://github.com/OpenChargingCloud/ChargyDesktopApp/blob/master/linux-live-image.md).
