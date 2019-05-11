# Creating a Linux Live ISO Image

This documentation is based on the documentation of the [TRuDI Live CD](https://bitbucket.org/dzgtrudi/trudi-public/src/523dc990c741630342bdc5aeb93375373b11fb88/doc/linux-live-image.md?at=master), which is a similar project of the [Physikalisch-Technische Bundesanstalt](https://www.ptb.de) for the transparency of smart meters, but was updated to support newer versions of Ubuntu Linux.

### Downloading and mounting of the original Ubuntu ISO image

We use Ubuntu 19.04 (amd64) as the base for our ISO image.

```
wget http://releases.ubuntu.com/19.04/ubuntu-19.04-desktop-amd64.iso

sudo modprobe loop
sudo modprobe iso9660
mkdir source
sudo mount -t iso9660 ./ubuntu-19.04-desktop-amd64.iso source -o ro,loop
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
sudo mount -t proc -o bind /proc new/proc
sudo mount -o bind /dev/pts new/dev/pts

sudo cp ../ChargyDesktopApp/dist/chargytransparenzsoftware_0.28.0_amd64.deb new/opt/
sudo cp ../ChargyDesktopApp/build/chargy_icon.png new/opt/
```

### Change root into the new Linux system and update the Linux system

```
sudo chroot new /bin/bash 
apt update
apt upgrade -y

sed -i 's/restricted/restricted universe multiverse/g' /etc/apt/sources.list
apt update
```

### Change system settings
```
echo "Europe/Berlin" > /etc/timezone
rm -f /etc/localtime
ln -sf /usr/share/zoneinfo/Europe/Berlin /etc/localtime
#dpkg-reconfigure tzdata
##apt install language-pack-de language-pack-gnome-de wngerman wogerman wswiss
update-locale LANG=de_DE.UTF-8 LANGUAGE=de_DE LC_ALL=de_DE.UTF-8
sed -i 's/XKBLAYOUT=\"us\"/XKBLAYOUT=\"de\"/g' /etc/default/keyboard
```

### Install Chargy Transparency Software
```
apt install -y joe mc
apt install -y /opt/chargytransparenzsoftware_0.28.0_amd64.deb
sed -i 's/Icon=chargytransparenzsoftware/Icon=\/opt\/chargy_icon.png/g' /usr/share/applications/chargytransparenzsoftware.desktop 

### gsettings set org.gnome.desktop.background picture-uri "file:///home/username/path/to/image.jpg"


mkdir /etc/skel/Desktop
cp /usr/share/applications/chargytransparenzsoftware.desktop /etc/skel/Desktop/

mkdir /etc/skel/.config
mkdir /etc/skel/.config/autostart
cp /usr/share/applications/chargytransparenzsoftware.desktop /etc/skel/.config/autostart/
```

### Remove legacy applications
```
apt purge -y libreoffice-common thunderbird aisleriot gnome-mahjongg gnome-mines gnome-sudoku libgnome-games-support-common
apt purge -y ubuntu-web-launchers gdb gdbserver gparted simple-scan sane-utils bolt bluez bluez-cups bluez-obexd transmission-common deja-dup cheese remmina remmina-common totem totem-common rhythmbox rhythmbox-data shotwell shotwell-common gnome-todo gnome-todo-common libgnome-todo
# Remove Ubuntu Installer
apt purge -y ubiquity ubiquity-casper ubiquity-slideshow-ubuntu ubiquity-ubuntu-artwork

??? gnome-initial-setup (because of cheese removal???)
```

### Do not do this!
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
    -o chargytransparenzsoftware_0.28.0_amd64.iso \
    -b isolinux/isolinux.bin \
    -c isolinux/boot.cat \
    -no-emul-boot \
    -boot-load-size 4 \
    -boot-info-table \
    -r \
    -V "Chargy Transparenz Software Live" \
    -cache-inodes  \
    -J \
    -l \
    ubuntu-livecd
```

OLD!!!

### Downloading and mounting of the original Ubuntu ISO image

We use Ubuntu 19.04 (amd64) as the base for our ISO image.

```
wget http://ftp-stud.hs-esslingen.de/pub/Mirrors/releases.ubuntu.com/19.04/ubuntu-19.04-desktop-amd64.iso

sudo modprobe loop
sudo modprobe iso9660
mkdir cd-mount
sudo mount -t iso9660 ./ubuntu-19.04-desktop-amd64.iso cd-mount/ -o ro,loop

mkdir ChargyLiveCD
mkdir ChargyLiveCD/iso
mkdir ChargyLiveCD/iso/casper
cp -rp cd-mount/EFI cd-mount/.disk cd-mount/boot cd-mount/isolinux cd-mount/pool cd-mount/dists  ChargyLiveCD/iso/
```

### Bootstrapping the new Ubuntu live system
```
sudo apt install debootstrap
cd ChargyLiveCD
sudo debootstrap --arch amd64 disco squashfs
```

Mount some virtual file systems into your change-root-environment and prepare this system for the installation of the base system:
```
sudo mount --bind /dev squashfs/dev
sudo mount -t devpts devpts squashfs/dev/pts
sudo mount -t proc proc squashfs/proc
sudo mount -t sysfs sysfs squashfs/sys

sudo cp /etc/resolv.conf squashfs/etc
sudo cp /etc/apt/sources.list squashfs/etc/apt
```

Now you can download and install security updates and the required additional software:
```
sudo chroot squashfs apt update
sudo chroot squashfs apt upgrade
sudo chroot squashfs apt autoremove

sudo chroot squashfs apt install linux-image-generic tzdata console-setup casper ubiquity-casper lupin-casper
sudo chroot squashfs apt install --no-install-recommends ubuntu-desktop evince netplan.io resolvconf git ssh joe mc firefox firefox-locale-de gedit
```

As the Chargy Live DVD is intended for the German "Eichrecht" we activate "German" as system language:
```
sudo chroot squashfs apt install language-pack-de language-pack-gnome-de wngerman wogerman wswiss
sudo chroot squashfs update-locale LANG=de_DE.UTF-8 LANGUAGE=de_DE LC_ALL=de_DE.UTF-8
```

Activate a German keyboard layout by editing the following file:
```
sudo joe squashfs/etc/default/keyboard 

XKBMODEL="pc105"
XKBLAYOUT="de,us"
XKBVARIANT=""
XKBOPTIONS="" 
BACKSPACE="guess"
```

Change the timezone to "Europe/Berlin":
```
sudo chroot squashfs dpkg-reconfigure tzdata
```

Setup networking via netplan.io:
```
sudo joe squashfs/etc/netplan/01-network-manager-all.yaml

network:
  version: 2
  renderer: networkd
  ethernets:
    enp0s3:
      dhcp4: true
      dhcp6: true
```

#### Automatic Login

First create a new user called 'chargy'...

```
sudo chroot squashfs adduser chargy
```

...then enable auto-login within the display manager

```
sudo joe squashfs/etc/gdm3/custom.conf

# Enabling automatic login
AutomaticLoginEnable = true
AutomaticLogin = chargy
```

### Bootvorgang anpassen

Dieser Schritt bezieht sich auf den Absatz: **_Bootvorgang und Laden der rechtlich relevanten Software_** _(PTB-8.51-MB08-BSLM-DE-V01)_.

Die Standardversion des Ubuntu Live-Systems bietet einige Bootvarianten und Installationsmöglichkeiten beim Start. Das muss verhindert werden, weil der Bootvorgang einheitlich und unbeeinflussbar sein muss.
Dazu müssen Dateien ```iso/boot/grub/grub.cfg``` sowie ```iso/isolinux/isolinux.cfg``` angepasst werden:

```sudo joe iso/boot/grub/grub.cfg```

Der Inhalt der Datei sollen Sie komplett entfernen.


Aufgrund der Veränderung der Datei ```isolinux.cfg``` werden einige Dateien im Verzeichnis ```iso/isolinux/``` nicht mehr gebraucht und Sie können diese löschen:

```
sudo rm iso/isolinux/*.tr
sudo rm iso/isolinux/*.hlp
sudo rm iso/isolinux/*.txt
sudo rm iso/isolinux/*.cfg
```
Legen Sie danach eine neue ```isolinux.cfg``` an:

```sudo joe iso/isolinux/isolinux.cfg```

Der Dateiinhalt sollte folgendermaßen aussehen (Parameter _NOESCAPE_ und _ALLOWOPTIONS_ sind besonders wichtig, um Eingabe von Bootparametern vom Benutzer zu verhindern):

```
DEFAULT chargy
PROMPT 0
TIMEOUT 0
NOESCAPE 1
ALLOWOPTIONS 0
 SAY Lade Chargy Ubuntu Live 19.04...
LABEL chargy
 KERNEL /casper/vmlinuz.efi
 APPEND BOOT_IMAGE=/casper/vmlinuz.efi boot=casper initrd=/casper/initrd.lz quiet splash --debian-installer/language=de console-setup/layoutcode?=de
``` 

### Erscheinungsbild anpassen

Sie können das Aussehen des Live-Systems individuell anpassen. Dieser Schritt ist nicht für die Anforderungen der PTB unbedingt notwendig. Es können aber unnötige Hintergrundbilder, sowie Icon-Pakete entfernt werden, und das ist wiederum im Absatz: **_Zulässige Komponenten_** _(PTB-8.51-MB08-BSLM-DE-V01)_ relevant, um das Live-Image möglichst klein zu halten. Dazu löschen Sie alle Dateien und Verzeichnisse aus dem Verzeichnis ``squashfs/usr/share/backgrounds/`` und kopieren Sie dort nur Euer individuelles Hintergrundbild.


Sie können das Hintergrundbild für die Desktopsitzung für alle Benutzer festlegen. Generieren Sie dazu in dem Verzeichnis `squashfs/etc/skel/.config/autostart` eine neue Datei mit der `.desktop` Erweiterung an. Das Kommando in dieser Datei wird beim Start der Gnome Sitzung automatisch ausgeführt. Falls nicht vorhanden, muss das Verzeichnis `squashfs/etc/skel/.config/autostart` zuerst angelegt werden.

```
sudo chroot squashfs mkdir /etc/skel/.config
sudo chroot squashfs mkdir /etc/skel/.config/autostart
sudo joe squashfs/etc/skel/.config/autostart/set_background.desktop
```

Die soll folgenden Inhalt haben:

```
[Desktop Entry]
Type=Application
Name=TRuDI Hintergrundbild
Exec=gsettings set org.gnome.desktop.background picture-uri 'file:///usr/share/backgrounds/trudi_background.png'
X-GNOME-Autostart-enabled=true
```

__Wichtig:__ Dieser Schritt sollte vor dem Anlegen des Testbenutzers gemacht werden. Der Testbenutzer kann aber einfach gelöscht und neu angelegt werden. Benutzen Sie zum Löschen folgendes Kommando:

```
sudo chroot squashfs deluser --remove-home trudi
```

Man kann auch das Aussehen der Benutzeroberfläche für die Benutzeranmeldung anpassen, indem man eigenen Hintergrund und eigenes Logo verwendet.

Das Hintergrundbild und Logo sollten in Verzeichnisse ``squashfs/usr/share/backgrounds/``, 
bzw.  ``squashfs/usr/share/unity-greeter/`` kopiert werden. Ã„ndern Sie dann die folgende Datei:

```
sudo joe squashfs/usr/share/glib-2.0/schemas/10_unity_greeter_background.gschema.override
```

Der Dateiinhalt sollte folgendermaßen aussehen:

```
[com.canonical.unity-greeter]
draw-user-backgrounds=false
background='/usr/share/backgrounds/trudi_background.png'
logo='/usr/share/unity-greeter/trudi_greeter_logo.png'
```











### Installing the Chargy software

This will copy the chargy debian package into the ``squashfs`` filesystem and install it with all dependencies
```
sudo cp ../ChargyDesktopApp/dist/chargytransparenzsoftware_0.28.0_amd64.deb ./squashfs/usr/share/
sudo chroot squashfs apt install /usr/share/chargytransparenzsoftware_0.28.0_amd64.deb
sudo rm ./squashfs/usr/share/chargytransparenzsoftware_0.28.0_amd64.deb
```

A user within the live system will always be created dynamically. Therefore it is good to create a desktop shortcut for everyone.
```
sudo mkdir squashfs/etc/skel/Desktop
sudo touch squashfs/etc/skel/Desktop/chargy.desktop
```

Create a file having the following content
```
sudo joe squashfs/etc/skel/Desktop/chargy.desktop

[Desktop Entry]
Name=Chargy Transparenz Software
Exec=chargytransparenzsoftware
Icon=/usr/share/backgrounds/chargytransparenzsoftware/icon.png
Terminal=false
Type=Application
```

Es muss noch ein Icon für die Verknüpfung eingerichtet werden (Es wird angenommen, dass Sie eine Datei namens icon.png bereits in das Arbeitsverzeichnis kopiert haben):

```
sudo mkdir squashfs/usr/share/backgrounds/chargytransparenzsoftware
sudo cp ../ChargyDesktopApp/build/chargy_icon.png squashfs/usr/share/backgrounds/chargytransparenzsoftware/icon.png
```

Das TRuDI Handbuch sollte sich auch im Desktop-Verzeichnis des Live-Systems befinden (Es wird angenommen, dass Sie das Dokument bereits in das Arbeitsverzeichnis kopiert haben):
```
sudo cp TRuDI-Handbuch.pdf squashfs/etc/skel/Desktop/TRuDI-Handbuch.pdf
```


### Automatischer Start des TRuDI Programms

Dieser Schritt bezieht sich auf die Absätze: **_Schutz in Verwendung_** und **_Bootvorgang und Laden der rechtlich relevanten Software_** _(PTB-8.51-MB08-BSLM-DE-V01)_.

Es bietet sich auch die Möglichkeit, das TRuDI-Programm nach der Benutzeranmeldung automatisch zu starten. Dazu kopiert man die Datei, die für die Desktopverknüpfung bereits angelegt wurde, in das Verzeichnis ``autostart``.
Falls nicht vorhanden, muss das Verzeichnis zuerst angelegt werden.
```
sudo chroot squashfs mkdir /etc/skel/.config
sudo chroot squashfs mkdir /etc/skel/.config/autostart
sudo cp squashfs/etc/skel/Desktop/TRuDI.desktop squashfs/etc/skel/.config/autostart/
```



## ISO-Image Fertigstellen

Erstellen Sie nun das ISO-Image wie folgt. Das Ergebnis ist eine neue Datei namens _live.iso_ in Ihrem Arbeitsverzeichnis: 

```
sudo chroot squashfs update-initramfs -k all -c -v
sudo cat squashfs/boot/initrd.img* > iso/casper/initrd.lz
sudo cp squashfs/boot/vmlinuz* iso/casper/vmlinuz.efi
sudo umount squashfs/dev/pts squashfs/dev squashfs/proc squashfs/sys
sudo mksquashfs squashfs iso/casper/filesystem.squashfs -noappend
sudo genisoimage -cache-inodes -r -J -l -b isolinux/isolinux.bin -c isolinux/boot.cat -no-emul-boot -boot-load-size 4 -boot-info-table -eltorito-alt-boot -e boot/grub/efi.img -no-emul-boot -o live.iso iso
```

## Hinweise für die Erstellung eines Live-USB Mediums

Damit das ISO-Image immer von der USB starten kann, erzeugen Sie ein _Hybrid_-Image daraus:

```
sudo apt install syslinux-utils
sudo isohybrid --uefi --verbose live.iso
```

Danach wird empfohlen, das Hybrid-Image auf das USB-Medium zu __klonen__. Dafür können Sie das Programm _mkusb_ direkt von ihrem Ubuntu Host-Rechner benutzen.
Sie können zwar Programme wie das _Unetbootin_ verwenden, um das Image auf das USB-Medium zu übertragen. Das _Unetbootin_ benötigt sogar das Hybrid-Image nicht, sondern Sie können ein normales ISO-Image auf das USB-Medium damit übertragen. Nachteil von diesen Programmen ist, dass Sie meistens einen eigenen Bootloader anlegen, und damit nicht weiter sichergestellt ist was in dem Absatz: **_Bootvorgang und Laden der rechtlich relevanten Software_** _(PTB-8.51-MB08-BSLM-DE-V01)_ gefordert wird.


https://askubuntu.com/questions/48535/how-to-customize-the-ubuntu-live-cd#
