# Creating a Linux Live ISO Image

This documentation is based on the following HowTo ["How to customize the Ubuntu Live CD?"](https://askubuntu.com/questions/48535/how-to-customize-the-ubuntu-live-cd#) and the documentation of the [TRuDI Live CD](https://bitbucket.org/dzgtrudi/trudi-public/src/523dc990c741630342bdc5aeb93375373b11fb88/doc/linux-live-image.md?at=master), which is a similar project of the [Physikalisch-Technische Bundesanstalt](https://www.ptb.de) for the transparency of smart meters, but was updated to support newer versions of Ubuntu Linux.

![](Screenshot_VirtualBox01.png)

### Preparing the Linux Live ISO Image

We use [Ubuntu 20.04 (amd64)](https://releases.ubuntu.com/20.04/ubuntu-20.04-desktop-amd64.iso) as the base for our ISO image. We expect this ChargyDesktopApp git repository located at *../ChargyDesktopApp*.

```
git clone https://github.com/OpenChargingCloud/ChargyDesktopApp.git
wget http://releases.ubuntu.com/20.04/ubuntu-20.04-desktop-amd64.iso

mkdir ChargyLive
cd ChargyLive

sudo modprobe loop
sudo modprobe iso9660
mkdir source
sudo mount -t iso9660 ../ubuntu-20.04-desktop-amd64.iso source -o ro,loop
mkdir ubuntu-livecd
cp -a source/. ubuntu-livecd
sudo chmod -R u+w ubuntu-livecd 
sudo umount source
rmdir source

mkdir old
sudo mount -t squashfs -o loop,ro ubuntu-livecd/casper/filesystem.squashfs old 

sudo dd if=/dev/zero of=ubuntu-fs.ext2 bs=1M count=7000
sudo mke2fs ubuntu-fs.ext2

mkdir new
sudo mount -o loop ubuntu-fs.ext2 new
sudo cp -va old/. new
sudo umount old
rmdir old

sudo cp /etc/resolv.conf new/etc/
sudo mount --bind /tmp new/tmp
sudo mount --bind /dev new/dev
sudo mount --bind /dev/pts new/dev/pts
sudo mount --bind /sys new/sys
sudo mount --bind /run new/run
sudo mount -t proc -o bind /proc new/proc

 // strange requirements since 20.04! Otherwise "No space left on device" might be reported during 'apt upgrade' or 'apt install'
sudo mount --bind /var/lib/apt new/var/lib/apt
sudo mount --bind /var/cache new/var/cache
sudo mount --bind /var/tmp new/var/tmp

sudo cp ../ChargyDesktopApp/dist/chargytransparenzsoftware_1.2.0_amd64.deb new/opt/
```

### Change root into the new Linux system and update all software packages
All updates are on your own risk of breaking the remaing procedures of this how-to.
```
sudo chroot new /bin/bash 
apt update
apt upgrade -y

sed -i 's/restricted/restricted universe multiverse/g' /etc/apt/sources.list
apt update
apt upgrade -y

apt install -y joe mc
```

### Change system settings
Currently the "Eichrecht" is just a very German way to e-mobility. Therefore set the system language to German.
```
echo "Europe/Berlin" > /etc/timezone
rm -f /etc/localtime
ln -sf /usr/share/zoneinfo/Europe/Berlin /etc/localtime
apt install -y language-pack-de language-pack-gnome-de wngerman wogerman wswiss
update-locale LANG=de_DE.UTF-8 LANGUAGE=de_DE LC_ALL=de_DE.UTF-8
sed -i 's/XKBLAYOUT=\"us\"/XKBLAYOUT=\"de\"/g' /etc/default/keyboard

mkdir /etc/skel/.config
echo "yes" >> /etc/skel/.config/gnome-initial-setup-done

### gsettings set org.gnome.desktop.background picture-uri "file:///home/username/path/to/image.jpg"
```

### Install Chargy Transparency Software
Install Chargy and make it easily accessible from the Desktop and via AutoStart.
```
apt install -y /opt/chargytransparenzsoftware_1.2.0_amd64.deb

# If the Chargy application icon is broken, try the following work-around
sed -i 's/Icon=chargytransparenzsoftware/Icon=\/opt\/Chargy\ Transparenzsoftware\/build\/chargy_icon.png/g' /usr/share/applications/chargytransparenzsoftware.desktop 

mkdir /etc/skel/Dokumente
cp /opt/Chargy\ Transparenzsoftware/documentation/chargeIT-Testdatensatz-01.chargy /etc/skel/Dokumente/
cp /opt/Chargy\ Transparenzsoftware/documentation/Chargy\ Transparenzsoftware\ Nutzerhandbuch\ v1.0.0.pdf /etc/skel/Dokumente/Chargy_Transparenzsoftware_Nutzerhandbuch_v1.0.0.pdf
chmod 644 /etc/skel/Dokumente/Chargy\ Transparenzsoftware/documentation/chargeIT-Testdatensatz-01.chargy
chmod 644 /etc/skel/Dokumente/Chargy_Transparenzsoftware_Nutzerhandbuch_v1.0.0.pdf

mkdir /etc/skel/.config/autostart
cp /usr/share/applications/chargytransparenzsoftware.desktop /etc/skel/.config/autostart/

echo -e "[org.gnome.shell]\nfavorite-apps=[ 'org.gnome.Nautilus.desktop', 'org.gnome.Software.desktop', 'yelp.desktop', 'org.gnome.Terminal.desktop', 'firefox.desktop', 'chargytransparenzsoftware.desktop' ]" > /usr/share/glib-2.0/schemas/90_gnome-shell.gschema.override
```

### Register Chargy MIME type and file extentions/associations
This should some day be part of the .deb package
```
echo "application/x-chargy=chargytransparencysoftware.desktop" >> /usr/share/applications/defaults.list

echo -e "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\n<mime-info xmlns=\"http://www.freedesktop.org/standards/shared-mime-info\">\n  <mime-type type=\"application/x-chargy\">\n    <comment>Chargy Transparency Dataset for E-Mobility</comment>\n    <glob pattern=\"*.chargy\"/>\n  </mime-type>\n</mime-info>" > /usr/share/mime/packages/application-chargy.xml

update-mime-database /usr/share/mime
update-desktop-database /usr/share/applications
```

### Optional PTB Security Settings
The PTB (Paternalistische Technische Bundesanstalt) demands that the logged-in Linux user is not able to install and run malicious software. The following settings should limit the risks.    
*Disclaimer: We do not recommend these changes!*
```
# gsettings list-recursively org.gnome.software
echo -e "[org.gnome.software]\nallow-updates=false\ndownload-updates=false\ndownload-updates-notify=false" > /usr/share/glib-2.0/schemas/91_gnome-software.gschema.override

# gsettings list-recursively org.gnome.desktop.media-handling
echo -e "[org.gnome.desktop.media-handling]\nautorun-never=true" > /usr/share/glib-2.0/schemas/92_gnome-desktop-media-handling.gschema.override

adduser --disabled-password --gecos "" chargy
sed -i 's/#  AutomaticLoginEnable = true/AutomaticLoginEnable = true/g' /etc/gdm3/custom.conf
sed -i 's/#  AutomaticLogin = user1/AutomaticLogin = chargy/g' /etc/gdm3/custom.conf

echo -e "Section \"ServerFlags\"\n    Option \"DontVTSwitch\" \"true\"\nEndSection" > /etc/X11/xorg.conf
sed -i 's/#NAutoVTs=6/NAutoVTs=0/g' /etc/systemd/logind.conf
sed -i 's/#ReserveVT=6/ReserveVT=0/g' /etc/systemd/logind.conf
```

### Remove legacy applications
The following applications are not required for runnung Chargy and therefore can safely be removed.
```
apt purge -y libreoffice-common thunderbird aisleriot gnome-mahjongg gnome-mines gnome-sudoku libgnome-games-support-common
apt purge -y gdb gdbserver gparted simple-scan sane-utils bolt bluez bluez-cups bluez-obexd transmission-common deja-dup cheese remmina remmina-common totem totem-common rhythmbox rhythmbox-data shotwell shotwell-common gnome-todo gnome-todo-common libgnome-todo
# Remove Ubuntu Installer
apt purge -y ubiquity ubiquity-casper ubiquity-slideshow-ubuntu ubiquity-ubuntu-artwork

??? gnome-initial-setup (because of cheese removal???)
```

### Do not do this!
Some Ubuntu Linux dependencies are broken now and any automatic removal would very likely make your system unusable!
```
apt autoremove
```

### Unmount everything, create file manifest and clear free space
```
exit
sudo umount new/proc
sudo umount new/dev/pts
sudo rm new/etc/resolv.conf

sudo chroot new dpkg-query -W --showformat='${Package} ${Version}\n' > ubuntu-livecd/casper/filesystem.manifest

sudo printf $(sudo du -sx --block-size=1 ubuntu-livecd/ | cut -f1) | sudo tee ubuntu-livecd/casper/filesystem.size
cd ubuntu-livecd
find -type f -print0 | sudo xargs -0 md5sum | grep -v isolinux/boot.cat | sudo tee md5sum.txt
cd ..

sudo dd if=/dev/zero of=new/dummyfile
sudo rm new/dummyfile
```

### Create new system image (will take a while)
```
sudo rm ubuntu-livecd/casper/filesystem.squashfs
cd new
sudo mksquashfs . ../ubuntu-livecd/casper/filesystem.squashfs -comp xz
cd ..
sudo umount new
rmdir new
```

### Create ISO image
```
sudo genisoimage \
    -o "Chargy Transparenzsoftware Live v1.2.0.iso" \
    -b isolinux/isolinux.bin \
    -c isolinux/boot.cat \
    -no-emul-boot \
    -boot-load-size 4 \
    -boot-info-table \
    -r \
    -V "Chargy Transparenzsoftware Live" \
    -cache-inodes  \
    -J \
    -l \
    ubuntu-livecd
```

### If you are still debugging and need to change some more files
```
mkdir new
sudo mount -o loop ubuntu-fs.ext2 new
sudo cp /etc/resolv.conf new/etc/
sudo mount -t proc -o bind /proc new/proc
sudo mount -o bind /dev/pts new/dev/pts
sudo chroot new /bin/bash
```
