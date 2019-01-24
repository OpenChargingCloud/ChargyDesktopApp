# Creating a Linux Live ISO Image


# Schritte zur Erstellung eines Live Linux ISO-Image

Original: https://bitbucket.org/dzgtrudi/trudi-public/src/523dc990c741630342bdc5aeb93375373b11fb88/doc/linux-live-image.md?at=master

Diese Beschreibung basiert auf der Anleitung "Live-Ubuntu selbstgebaut" aus dem [c't Heft 11/2016](https://www.heise.de/ct/ausgabe/2016-11-Selbstgemachtes-Live-Ubuntu-fuer-DVD-und-USB-Stick-3198759.html), des Autors Mirko Dölle.

Als Grundlage wurde die amd64-Variante der Ubuntu-Installations-DVD (die TRuDI ist eine 64-Bit-Applikation) der LTS Version 18.04.1 LTS verwendet.


# Original ISO-image per loop mounten
```
wget http://ftp-stud.hs-esslingen.de/pub/Mirrors/releases.ubuntu.com/18.04.1/ubuntu-18.04.1-desktop-amd64.iso
sudo modprobe loop
sudo modprobe iso9660
mkdir cd-mount
sudo mount -t iso9660 ./ubuntu-18.04.1-desktop-amd64.iso cd-mount/ -o ro,loop
```

# Verzeichnis fuer Live-System-Daten anlegen
```
mkdir chargy_LiveCD
mkdir chargy_LiveCD/iso
mkdir chargy_LiveCD/iso/casper
cp -rp cd-mount/EFI cd-mount/.disk cd-mount/boot cd-mount/isolinux cd-mount/pool cd-mount/dists  chargy_LiveCD/iso/

sudo apt install debootstrap
sudo debootstrap --arch amd64 xenial squashfs
```

Um das erzeugte Live-System in Ihr laufendes System einzubinden, führen Sie folgende Befehle aus:

```
sudo mount --bind /dev squashfs/dev
sudo mount -t devpts devpts squashfs/dev/pts
sudo mount -t proc proc squashfs/proc
sudo mount -t sysfs sysfs squashfs/sys
```

Um Pakete über die Offizielle Quellen beziehen zu können, führen Sie folgendes aus:

```
sudo cp /etc/resolv.conf squashfs/etc
sudo cp /etc/apt/sources.list squashfs/etc/apt
```

Nun kann man die Quellen, und danach essentielle Softwarepakete aktualisieren:

```
sudo chroot squashfs apt update
sudo chroot squashfs apt upgrade

sudo chroot squashfs apt install linux-image-generic tzdata console-setup casper ubiquity-casper lupin-casper
sudo chroot squashfs apt install --no-install-recommends ubuntu-desktop evince git ssh firefox firefox-locale-de gedit
```

Für die deutsche Sprachunterstützung sind folgende Pakete nötig: 

```
sudo chroot squashfs apt install language-pack-de language-pack-gnome-de wngerman wogerman wswiss
```

Setzen Sie Deutsch als Standardsprache wie folgt:
```
sudo chroot squashfs update-locale LANG=de_DE.UTF-8 LANGUAGE=de_DE LC_ALL=de_DE.UTF-8
```

Ã„ndern sie folgende Datei, um die deutsche Tastatur als Standard beim Bootvorgang einzustellen:

```
sudo joe squashfs/etc/default/keyboard 
```

Der Dateiinhalt sollte wie folgt aussehen:

```
XKBMODEL="pc105"
XKBLAYOUT="de,us"
XKBVARIANT=""
XKBOPTIONS="" 
BACKSPACE="guess"
```

Die Zeitzone auf "Europe/Berlin" stellen
```
#sudo echo "Europe/Berlin" > squashfs/etc/timezone
sudo chroot squashfs dpkg-reconfigure tzdata
```


Kopieren Sie das Installationspaket der aktuelle TRuDI-Version in den ``squashfs`` Verzeichnisbaum und führen Sie die Installation aus. (alle abhängigen Pakete werden automatisch mitinstalliert):

```
sudo cp ChargyDesktopApp/out/make/chargyapp_0.13.0_amd64.deb ./squashfs/usr/share/
sudo chroot squashfs apt install /usr/share/chargyapp_0.13.0_amd64.deb
sudo rm ./squashfs/usr/share/chargyapp_0.13.0_amd64.deb
```

Eine Desktopverknüpfung für die TRuDI legt man im Verzeichnis squashfs/etc/skel/ an, da ein Benutzer beim Live-System immer dynamisch angelegt wird:

```
sudo mkdir squashfs/etc/skel/Desktop
sudo touch squashfs/etc/skel/Desktop/chargy.desktop
sudo joe squashfs/etc/skel/Desktop/chargy.desktop
```

Der Dateiinhalt sollte folgendermaßen aussehen:

```
[Desktop Entry]
Name=chargy
Exec=chargyapp
Icon=/usr/share/backgounds/chargy/icon.png
Terminal=false
Type=Application
```

Es muss noch ein Icon für die Verknüpfung eingerichtet werden (Es wird angenommen, dass Sie eine Datei namens icon.png bereits in das Arbeitsverzeichnis kopiert haben):

```
sudo mkdir squashfs/usr/share/backgounds/chargy
sudo cp icon.png squashfs/usr/share/backgounds/chargy/icon.png
```

Das TRuDI Handbuch sollte sich auch im Desktop-Verzeichnis des Live-Systems befinden (Es wird angenommen, dass Sie das Dokument bereits in das Arbeitsverzeichnis kopiert haben):
```
sudo cp TRuDI-Handbuch.pdf squashfs/etc/skel/Desktop/TRuDI-Handbuch.pdf
```

## Optionale Schritte

Folgende Schritte sind für ein lauffähiges Live-Image nicht notwendig.
Wenn das Live-Image die PTB Anforderungen aus dem **_Merkblatt: Einrichten eines Live-Mediums_** _(PTB-8.51-MB08-BSLM-DE-V01)_ erfüllen soll, sollten sie aber gemacht werden.


### Nicht benötigte Pakete deinstallieren

Dieser Schritt bezieht sich auf den Absatz: **_Zulässige Komponenten_** _(PTB-8.51-MB08-BSLM-DE-V01)_.

Um das Live-Image möglichst klein zu halten, sollten möglichst viele Pakete die zwar mit dem minimalen Installationsumfang vom Ubuntu kommen, aber nicht benötigt werden, deinstalliert werden:

```
sudo chroot squashfs apt-get autoremove --purge ubuntu-wallpapers-xenial
sudo chroot squashfs apt-get autoremove --purge ubiquity-casper
sudo chroot squashfs apt-get autoremove --purge samba-libs
sudo chroot squashfs apt-get autoremove --purge gnome-terminal
sudo chroot squashfs apt-get autoremove --purge ubuntu-wallpapers-xenial
sudo chroot squashfs apt-get autoremove --purge ubuntu-mobile-icons
sudo chroot squashfs apt-get autoremove --purge openssh-client
sudo chroot squashfs apt-get autoremove --purge suru-icon-theme
```

Durch die Aktualisierung der Softwarepakete werden im chroot-System womöglich mehrere Kernels installiert sein. Sie sollten alle alten Versionen deinstallieren. Neueste Version zum Aktuellen Zeitpunkt ist die Version: `linux-image-4.4.0-119-generic`). 

```
sudo chroot squashfs apt-get autoremove --purge linux-image-4.4.0-109-generic
sudo chroot squashfs apt-get autoremove --purge linux-image-4.4.0-112-generic
```

### Festes Benutzerkonto einrichten

Dieser Schritt bezieht sich auf den Absatz: **_Schutz in Verwendung_** _(PTB-8.51-MB08-BSLM-DE-V01)_.

Die Standardversion des Ubuntu Live-Systems legt bei jedem Start einen Benutzer namens ``ubuntu`` dynamisch an. 
Dieser Benutzer hat standardmäßig kein Passwort und kann mit ``sudo`` Administratorrechte bekommen. 
Es ist daher notwendig einen festen Benutzer mit eingeschränkten Benutzerrechten auf dem System einzurichten. 
Standardmäßig kann dieser Benutzer keine Aktionen die Systemadministratorrechte benötigen, ausführen. Damit ist auch sichergestellt, dass aus dem Live-System keine Massenspeicher, die womöglich das Betriebssystem oder andere Daten des Host-Rechners enthalten, eingebunden werden können.

Neuer Benutzer wird mit dem Kommando ``adduser`` erstellt. 
Benutzername und Passwort kann man auf ``trudi`` setzen und alle weiteren Fragen überspringen.

```
sudo chroot squashfs adduser trudi
```



### Automatische Anmeldung des trudi-Benutzers und Deaktivierung der Gastbenutzeroption

Dieser Schritt bezieht sich auf die Absätze: **_Schutz in Verwendung_** und **_Bootvorgang und Laden der rechtlich relevanten Software_** _(PTB-8.51-MB08-BSLM-DE-V01)_.

Folgende Datei muss angepasst werden:

```sudo joe squashfs/etc/lightdm/lightdm.conf```

Der Dateiinhalt sollte folgendermaßen aussehen:

```
[Seat:*]
autologin-user=trudi
autologin-user-timeout=0
allow-guest=false
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

### Deaktivierung von virtuellen Konsolen
Dieser Schritt bezieht sich auf die Absätze: **_Schutz in Verwendung_** und **_Bootvorgang und Laden der rechtlich relevanten Software_** _(PTB-8.51-MB08-BSLM-DE-V01)_.

Man kann die Tastenkombinationen für die virtuellen Konsolen abfangen. Legen Sie dazu eine Datei mit `.config` Erweiterung im Verzeichnis `etc/X11/xorg.conf.d`:
```
sudo chroot squashfs mkdir /etc/X11/xorg.conf.d
sudo joe squashfs/etc/X11/xorg.conf.d/50-novtswitch.conf
```
Der Dateiinhalt sollte folgendermaßen aussehen:

```
Section "ServerFlags"
Option "DontVTSwitch" "true"
EndSection
``` 

Ausser dem Abfangen von Tastenkombinationen, kann man auch in den systemd Prozess eingreifen. Man muss dazu die Datei `/etc/systemd/logind.conf` anpassen, indem man Zeilen für Parameter `NAutoVTs` und `ReserveVT`, wie folgt modifiziert:
```
NAutoVTs=0
ReserveVT=0
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
 SAY Lade chargy Ubuntu Live 16.04...
LABEL chargy
 KERNEL /casper/vmlinuz.efi
 APPEND BOOT_IMAGE=/casper/vmlinuz.efi boot=casper initrd=/casper/initrd.lz quiet splash --debian-installer/language=de console-setup/layoutcode?=de
``` 



### Firewall einrichten

Dieser Schritt bezieht sich auf den Absatz: **_Rückwirkungsfreiheit der Schnittstellen_** _(PTB-8.51-MB08-BSLM-DE-V01)_.

Benutzen Sie dazu das Programm _ufw_. Es muss zuerst in das chroot-System installiert werden. Installieren Sie auch Pakete _iptables_ und _ip6tables_ weil diese wahrscheinlich noch nicht installiert sind.

```
sudo chroot squashfs apt-get install iptables ip6tables
sudo chroot squashfs apt-get install ufw
``` 

__Wichtig:__ vor dem Einrichten der Firewall Regeln im chroot-System, sollte das Programm _ufw_ auch auf dem Host-Rechner installiert sein, weil das chroot-System während der Live-Image Einrichtung das Kernel (und die Module) des Host-Rechners benutzt. Aus diesem Grund muss auch zuerst die Firewall des Host-Rechners laufen:

```
sudo ufw enable
```

Aktivieren Sie dann die Firewall am chroot-System, und geben die Regeln an. Alle eingehenden Pakete werden standardmäßig blockiert. Es sollen dann auch alle ausgehenden Pakete blockiert werden, bis auf bestimmte Portnummern die für die Kommunikation an den HAN-Schnittstellen der Smart Meter Gateways verwendet werden:

```
sudo chroot squashfs ufw enable
sudo chroot squashfs ufw default deny outgoing
sudo chroot squashfs ufw allow out 80
sudo chroot squashfs ufw allow out 443
sudo chroot squashfs ufw allow out 883
sudo chroot squashfs ufw allow out 884
sudo chroot squashfs ufw allow out 5556
sudo chroot squashfs ufw allow out 10443
sudo chroot squashfs ufw disable
sudo chroot squashfs ufw enable
```

Die Deaktivierung und erneute Aktivierung zum Schluss ist notwendig, damit die Einstellungen im chroot-System für den nächsten Systemstart übernommen werden.

Ãœberprüfen Sie die Die Liste der Firewall-Regeln:

```
sudo chroot squashfs ufw status verbose
```

Diese sollte wie folgt aussehen:

```
Status: active
Logging: on (low)
Default: deny (incoming), deny (outgoing), disabled (routed)
New profiles: skip

To                         Action      From
--                         ------      ----
443                        ALLOW OUT   Anywhere                  
80                         ALLOW OUT   Anywhere                  
883                        ALLOW OUT   Anywhere                  
884                        ALLOW OUT   Anywhere                  
5556                       ALLOW OUT   Anywhere                  
10443                      ALLOW OUT   Anywhere                  
443 (v6)                   ALLOW OUT   Anywhere (v6)             
80 (v6)                    ALLOW OUT   Anywhere (v6)             
883 (v6)                   ALLOW OUT   Anywhere (v6)             
884 (v6)                   ALLOW OUT   Anywhere (v6)             
5556 (v6)                  ALLOW OUT   Anywhere (v6)             
10443 (v6)                 ALLOW OUT   Anywhere (v6) 
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

## ISO-Image Fertigstellen

Erstellen Sie nun das ISO-Image wie folgt. Das Ergebnis ist eine neue Datei namens _live.iso_ in Ihrem Arbeitsverzeichnis: 

```
sudo chroot squashfs update-initramfs -k all -c -v
#sudo zcat squashfs/boot/initrd.img* | lzma -9c > iso/casper/initrd.lz
sudo cat squashfs/boot/initrd.img* > iso/casper/initrd.lz
sudo cp squashfs/boot/vmlinuz* iso/casper/vmlinuz.efi
sudo umount squashfs/dev/pts squashfs/dev squashfs/proc squashfs/sys
sudo echo "nameserver 8.8.8.8" > squashfs/etc/resolv.conf
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




## Install Chargy

```
sudo apt install curl
sudo curl -sL https://deb.nodesource.com/setup_11.x | sudo bash -
sudo apt install nodejs
sudo npm install -g sass
sudo npm install -g typescript
```

```
sudo apt install git
git clone https://github.com/OpenChargingCloud/ChargyDesktopApp.git
cd ChargyDesktopApp
npm install
```



https://askubuntu.com/questions/48535/how-to-customize-the-ubuntu-live-cd#
