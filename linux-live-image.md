Original: https://bitbucket.org/dzgtrudi/trudi-public/src/523dc990c741630342bdc5aeb93375373b11fb88/doc/linux-live-image.md?at=master

# Schritte zur Erstellung eines Live Linux ISO-Image

Diese Beschreibung basiert auf der Anleitung "Live-Ubuntu selbstgebaut" aus dem [c't Heft 11/2016](https://www.heise.de/ct/ausgabe/2016-11-Selbstgemachtes-Live-Ubuntu-fuer-DVD-und-USB-Stick-3198759.html), des Autors Mirko DÃ¶lle.

Als Grundlage wurde die amd64-Variante der Ubuntu-Installations-DVD (die TRuDI ist eine 64-Bit-Applikation) der LTS Version 16.04 verwendet.


Legen Sie im Benutzerverzeichnis zuerst ein neues Arbeitsverzeichnis, z.B. ``TRuDI_LiveCD`` an. 
- In diesem Verzeichnis legen Sie dann ein neues Verzeichnis namens ``iso`` an.
-  Darin legen sie ein neues Verzeichnis namens ``casper`` an, und kopieren Sie, von der Installations-DVD, die Verzeichnisse ``.disk``, ``boot``, ``isolinux`` und ``EFI`` dorthin. Kopieren Sie auch die letzte Version von TRuDI Software in das Arbeitsverzeichnis.

Erzeugen Sie nun mit dem Tool ``debootstrap`` das Live-System in einem neuen Verzeichnis namens ``squashfs`` in unserem Arbeitsverzeichnis. 

```
~/TRuDI_LiveCD$ sudo debootstrap --arch amd64 xenial squashfs
```

Um das erzeugte Live-System in Ihr laufendes System einzubinden, fÃ¼hren Sie folgende Befehle aus:

```
~/TRuDI_LiveCD$ sudo mount --bind /dev squashfs/dev
~/TRuDI_LiveCD$ sudo mount -t devpts devpts squashfs/dev/pts
~/TRuDI_LiveCD$ sudo mount -t proc proc squashfs/proc
~/TRuDI_LiveCD$ sudo mount -t sysfs sysfs squashfs/sys
```

Um Pakete Ã¼ber die Offizielle Quellen beziehen zu kÃ¶nnen, fÃ¼hren Sie folgendes aus:

```
~/TRuDI_LiveCD$ sudo cp /etc/resolv.conf squashfs/etc
~/TRuDI_LiveCD$ sudo cp /etc/apt/sources.list squashfs/etc/apt
```

Nun kann man die Quellen, und danach auch die Softwarepakete aktualisieren:

```
~/TRuDI_LiveCD$ sudo chroot squashfs apt update
~/TRuDI_LiveCD$ sudo chroot squashfs apt upgrade
```

Installieren Sie nun folgende essentielle Pakete:

```
~/TRuDI_LiveCD$ sudo chroot squashfs apt install linux-image-generic
~/TRuDI_LiveCD$ sudo chroot squashfs apt install tzdata
~/TRuDI_LiveCD$ sudo chroot squashfs apt install console-setup
~/TRuDI_LiveCD$ sudo chroot squashfs apt install casper
~/TRuDI_LiveCD$ sudo chroot squashfs apt install ubiquity-casper
~/TRuDI_LiveCD$ sudo chroot squashfs apt install lupin-casper
~/TRuDI_LiveCD$ sudo chroot squashfs apt install --no-install-recommends ubuntu-desktop
```

FÃ¼r die deutsche SprachunterstÃ¼tzung sind folgende Pakete nÃ¶tig: 

```
~/TRuDI_LiveCD$ sudo chroot squashfs apt install language-pack-de
~/TRuDI_LiveCD$ sudo chroot squashfs apt install language-pack-gnome-de
~/TRuDI_LiveCD$ sudo chroot squashfs apt install wngerman
~/TRuDI_LiveCD$ sudo chroot squashfs apt install wogerman
~/TRuDI_LiveCD$ sudo chroot squashfs apt install wswiss
```

Setzen Sie Deutsch als Standardsprache wie folgt:
```
~/TRuDI_LiveCD$ sudo chroot squashfs update-locale LANG=de_DE.UTF-8 LANGUAGE=de_DE LC_ALL=de_DE.UTF-8
```

Ã„ndern sie folgende Datei, um die deutsche Tastatur als Standard beim Bootvorgang einzustellen:

```
~/TRuDI_LiveCD$ sudo nano squashfs/etc/default/keyboard 
```

Der Dateiinhalt sollte wie folgt aussehen:

```
XKBMODEL="pc105"
XKBLAYOUT="de,us"
XKBVARIANT=""
XKBOPTIONS="" 
BACKSPACE="guess"
```

Kopieren Sie das Installationspaket der aktuelle TRuDI-Version in den ``squashfs`` Verzeichnisbaum und fÃ¼hren Sie die Installation aus. (alle abhÃ¤ngigen Pakete werden automatisch mitinstalliert):

```
~/TRuDI_LiveCD$ sudo cp TRuDI-1.0.38_amd64.deb ./squashfs/usr/share/
~/TRuDI_LiveCD$ sudo chroot squashfs apt install /usr/share/TRuDI-1.0.38_amd64.deb
~/TRuDI_LiveCD$ sudo rm ./squashfs/usr/share/TRuDI-1.0.38_amd64.deb
```

Eine DesktopverknÃ¼pfung fÃ¼r die TRuDI legt man im Verzeichnis squashfs/etc/skel/ an, da ein Benutzer beim Live-System immer dynamisch angelegt wird:

```
~/TRuDI_LiveCD$ sudo mkdir squashfs/etc/skel/Desktop
~/TRuDI_LiveCD$ sudo touch squashfs/etc/skel/Desktop/TRuDI.desktop
~/TRuDI_LiveCD$ sudo nano squashfs/etc/skel/Desktop/TRuDI.desktop
```

Der Dateiinhalt sollte folgendermaÃŸen aussehen:

```
[Desktop Entry]
Name=TRuDI
Exec=trudi
Icon=/usr/share/backgounds/trudi/icon.png
Terminal=false
Type=Application
```

Es muss noch ein Icon fÃ¼r die VerknÃ¼pfung eingerichtet werden (Es wird angenommen, dass Sie eine Datei namens icon.png bereits in das Arbeitsverzeichnis kopiert haben):

```
~/TRuDI_LiveCD$ sudo mkdir squashfs/usr/share/backgounds/trudi
~/TRuDI_LiveCD$ sudo cp icon.png squashfs/usr/share/backgounds/trudi/icon.png
```

Das TRuDI Handbuch sollte sich auch im Desktop-Verzeichnis des Live-Systems befinden (Es wird angenommen, dass Sie das Dokument bereits in das Arbeitsverzeichnis kopiert haben):
```
~/TRuDI_LiveCD$ sudo cp TRuDI-Handbuch.pdf squashfs/etc/skel/Desktop/TRuDI-Handbuch.pdf
```

Um das PDF-Dokument Ã¶ffnen zu kÃ¶nnen, muss auch ein passender Viewer installiert werden (z.B. evince):

```
~/TRuDI_LiveCD$ sudo chroot squashfs apt install evince
```


## Optionale Schritte

Folgende Schritte sind fÃ¼r ein lauffÃ¤higes Live-Image nicht notwendig.
Wenn das Live-Image die PTB Anforderungen aus dem **_Merkblatt: Einrichten eines Live-Mediums_** _(PTB-8.51-MB08-BSLM-DE-V01)_ erfÃ¼llen soll, sollten sie aber gemacht werden.


### Nicht benÃ¶tigte Pakete deinstallieren

Dieser Schritt bezieht sich auf den Absatz: **_ZulÃ¤ssige Komponenten_** _(PTB-8.51-MB08-BSLM-DE-V01)_.

Um das Live-Image mÃ¶glichst klein zu halten, sollten mÃ¶glichst viele Pakete die zwar mit dem minimalen Installationsumfang vom Ubuntu kommen, aber nicht benÃ¶tigt werden, deinstalliert werden:

```
~/TRuDI_LiveCD$ sudo chroot squashfs apt-get autoremove --purge ubuntu-wallpapers-xenial
~/TRuDI_LiveCD$ sudo chroot squashfs apt-get autoremove --purge ubiquity-casper
~/TRuDI_LiveCD$ sudo chroot squashfs apt-get autoremove --purge samba-libs
~/TRuDI_LiveCD$ sudo chroot squashfs apt-get autoremove --purge gnome-terminal
~/TRuDI_LiveCD$ sudo chroot squashfs apt-get autoremove --purge ubuntu-wallpapers-xenial
~/TRuDI_LiveCD$ sudo chroot squashfs apt-get autoremove --purge ubuntu-mobile-icons
~/TRuDI_LiveCD$ sudo chroot squashfs apt-get autoremove --purge openssh-client
~/TRuDI_LiveCD$ sudo chroot squashfs apt-get autoremove --purge suru-icon-theme
```

Durch die Aktualisierung der Softwarepakete werden im chroot-System womÃ¶glich mehrere Kernels installiert sein. Sie sollten alle alten Versionen deinstallieren. Neueste Version zum Aktuellen Zeitpunkt ist die Version: `linux-image-4.4.0-119-generic`). 

```
~/TRuDI_LiveCD$ sudo chroot squashfs apt-get autoremove --purge linux-image-4.4.0-109-generic
~/TRuDI_LiveCD$ sudo chroot squashfs apt-get autoremove --purge linux-image-4.4.0-112-generic
```

### Festes Benutzerkonto einrichten

Dieser Schritt bezieht sich auf den Absatz: **_Schutz in Verwendung_** _(PTB-8.51-MB08-BSLM-DE-V01)_.

Die Standardversion des Ubuntu Live-Systems legt bei jedem Start einen Benutzer namens ``ubuntu`` dynamisch an. 
Dieser Benutzer hat standardmÃ¤ÃŸig kein Passwort und kann mit ``sudo`` Administratorrechte bekommen. 
Es ist daher notwendig einen festen Benutzer mit eingeschrÃ¤nkten Benutzerrechten auf dem System einzurichten. 
StandardmÃ¤ÃŸig kann dieser Benutzer keine Aktionen die Systemadministratorrechte benÃ¶tigen, ausfÃ¼hren. Damit ist auch sichergestellt, dass aus dem Live-System keine Massenspeicher, die womÃ¶glich das Betriebssystem oder andere Daten des Host-Rechners enthalten, eingebunden werden kÃ¶nnen.

Neuer Benutzer wird mit dem Kommando ``adduser`` erstellt. 
Benutzername und Passwort kann man auf ``trudi`` setzen und alle weiteren Fragen Ã¼berspringen.

```
~/TRuDI_LiveCD$ sudo chroot squashfs adduser trudi
```



### Automatische Anmeldung des trudi-Benutzers und Deaktivierung der Gastbenutzeroption

Dieser Schritt bezieht sich auf die AbsÃ¤tze: **_Schutz in Verwendung_** und **_Bootvorgang und Laden der rechtlich relevanten Software_** _(PTB-8.51-MB08-BSLM-DE-V01)_.

Folgende Datei muss angepasst werden:

```~/TRuDI_LiveCD$ sudo nano squashfs/etc/lightdm/lightdm.conf```

Der Dateiinhalt sollte folgendermaÃŸen aussehen:

```
[Seat:*]
autologin-user=trudi
autologin-user-timeout=0
allow-guest=false
```

### Automatischer Start des TRuDI Programms

Dieser Schritt bezieht sich auf die AbsÃ¤tze: **_Schutz in Verwendung_** und **_Bootvorgang und Laden der rechtlich relevanten Software_** _(PTB-8.51-MB08-BSLM-DE-V01)_.

Es bietet sich auch die MÃ¶glichkeit, das TRuDI-Programm nach der Benutzeranmeldung automatisch zu starten. Dazu kopiert man die Datei, die fÃ¼r die DesktopverknÃ¼pfung bereits angelegt wurde, in das Verzeichnis ``autostart``.
Falls nicht vorhanden, muss das Verzeichnis zuerst angelegt werden.
```
~/TRuDI_LiveCD$ sudo chroot squashfs mkdir /etc/skel/.config
~/TRuDI_LiveCD$ sudo chroot squashfs mkdir /etc/skel/.config/autostart
~/TRuDI_LiveCD$ sudo cp squashfs/etc/skel/Desktop/TRuDI.desktop squashfs/etc/skel/.config/autostart/
```

### Deaktivierung von virtuellen Konsolen
Dieser Schritt bezieht sich auf die AbsÃ¤tze: **_Schutz in Verwendung_** und **_Bootvorgang und Laden der rechtlich relevanten Software_** _(PTB-8.51-MB08-BSLM-DE-V01)_.

Man kann die Tastenkombinationen fÃ¼r die virtuellen Konsolen abfangen. Legen Sie dazu eine Datei mit `.config` Erweiterung im Verzeichnis `etc/X11/xorg.conf.d`:
```
~/TRuDI_LiveCD$ sudo chroot squashfs mkdir /etc/X11/xorg.conf.d
~/TRuDI_LiveCD$ sudo nano squashfs/etc/X11/xorg.conf.d/50-novtswitch.conf
```
Der Dateiinhalt sollte folgendermaÃŸen aussehen:

```
Section "ServerFlags"
Option "DontVTSwitch" "true"
EndSection
``` 

Ausser dem Abfangen von Tastenkombinationen, kann man auch in den systemd Prozess eingreifen. Man muss dazu die Datei `/etc/systemd/logind.conf` anpassen, indem man Zeilen fÃ¼r Parameter `NAutoVTs` und `ReserveVT`, wie folgt modifiziert:
```
NAutoVTs=0
ReserveVT=0
``` 


### Bootvorgang anpassen

Dieser Schritt bezieht sich auf den Absatz: **_Bootvorgang und Laden der rechtlich relevanten Software_** _(PTB-8.51-MB08-BSLM-DE-V01)_.

Die Standardversion des Ubuntu Live-Systems bietet einige Bootvarianten und InstallationsmÃ¶glichkeiten beim Start. Das muss verhindert werden, weil der Bootvorgang einheitlich und unbeeinflussbar sein muss.
Dazu mÃ¼ssen Dateien ```iso/boot/grub/grub.cfg``` sowie ```iso/isolinux/isolinux.cfg``` angepasst werden:

```~/TRuDI_LiveCD$ sudo nano iso/boot/grub/grub.cfg```

Der Inhalt der Datei sollen Sie komplett entfernen.


Aufgrund der VerÃ¤nderung der Datei ```isolinux.cfg``` werden einige Dateien im Verzeichnis ```iso/isolinux/``` nicht mehr gebraucht und Sie kÃ¶nnen diese lÃ¶schen:

```
~/TRuDI_LiveCD$ sudo rm iso/isolinux/*.tr
~/TRuDI_LiveCD$ sudo rm iso/isolinux/*.hlp
~/TRuDI_LiveCD$ sudo rm iso/isolinux/*.txt
~/TRuDI_LiveCD$ sudo rm iso/isolinux/*.cfg
```
Legen Sie danach eine neue ```isolinux.cfg``` an:

```~/TRuDI_LiveCD$ sudo nano iso/isolinux/isolinux.cfg```

Der Dateiinhalt sollte folgendermaÃŸen aussehen (Parameter _NOESCAPE_ und _ALLOWOPTIONS_ sind besonders wichtig, um Eingabe von Bootparametern vom Benutzer zu verhindern):

```
DEFAULT trudi
PROMPT 0
TIMEOUT 0
NOESCAPE 1
ALLOWOPTIONS 0
 SAY Lade TRuDI Ubuntu Live 16.04...
LABEL trudi
 KERNEL /casper/vmlinuz.efi
 APPEND BOOT_IMAGE=/casper/vmlinuz.efi boot=casper initrd=/casper/initrd.lz quiet splash --debian-installer/language=de console-setup/layoutcode?=de
``` 



### Firewall einrichten

Dieser Schritt bezieht sich auf den Absatz: **_RÃ¼ckwirkungsfreiheit der Schnittstellen_** _(PTB-8.51-MB08-BSLM-DE-V01)_.

Benutzen Sie dazu das Programm _ufw_. Es muss zuerst in das chroot-System installiert werden. Installieren Sie auch Pakete _iptables_ und _ip6tables_ weil diese wahrscheinlich noch nicht installiert sind.

```
~/TRuDI_LiveCD$ sudo chroot squashfs apt-get install iptables
~/TRuDI_LiveCD$ sudo chroot squashfs apt-get install ip6tables
~/TRuDI_LiveCD$ sudo chroot squashfs apt-get install ufw
``` 

__Wichtig:__ vor dem Einrichten der Firewall Regeln im chroot-System, sollte das Programm _ufw_ auch auf dem Host-Rechner installiert sein, weil das chroot-System wÃ¤hrend der Live-Image Einrichtung das Kernel (und die Module) des Host-Rechners benutzt. Aus diesem Grund muss auch zuerst die Firewall des Host-Rechners laufen:

```
~/TRuDI_LiveCD$ sudo ufw enable
```

Aktivieren Sie dann die Firewall am chroot-System, und geben die Regeln an. Alle eingehenden Pakete werden standardmÃ¤ÃŸig blockiert. Es sollen dann auch alle ausgehenden Pakete blockiert werden, bis auf bestimmte Portnummern die fÃ¼r die Kommunikation an den HAN-Schnittstellen der Smart Meter Gateways verwendet werden:

```
~/TRuDI_LiveCD$ sudo chroot squashfs ufw enable
~/TRuDI_LiveCD$ sudo chroot squashfs ufw default deny outgoing
~/TRuDI_LiveCD$ sudo chroot squashfs ufw allow out 80
~/TRuDI_LiveCD$ sudo chroot squashfs ufw allow out 443
~/TRuDI_LiveCD$ sudo chroot squashfs ufw allow out 883
~/TRuDI_LiveCD$ sudo chroot squashfs ufw allow out 884
~/TRuDI_LiveCD$ sudo chroot squashfs ufw allow out 5556
~/TRuDI_LiveCD$ sudo chroot squashfs ufw allow out 10443
~/TRuDI_LiveCD$ sudo chroot squashfs ufw disable
~/TRuDI_LiveCD$ sudo chroot squashfs ufw enable
```

Die Deaktivierung und erneute Aktivierung zum Schluss ist notwendig, damit die Einstellungen im chroot-System fÃ¼r den nÃ¤chsten Systemstart Ã¼bernommen werden.

ÃœberprÃ¼fen Sie die Die Liste der Firewall-Regeln:

```
~/TRuDI_LiveCD$ sudo chroot squashfs ufw status verbose
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

Sie kÃ¶nnen das Aussehen des Live-Systems individuell anpassen. Dieser Schritt ist nicht fÃ¼r die Anforderungen der PTB unbedingt notwendig. Es kÃ¶nnen aber unnÃ¶tige Hintergrundbilder, sowie Icon-Pakete entfernt werden, und das ist wiederum im Absatz: **_ZulÃ¤ssige Komponenten_** _(PTB-8.51-MB08-BSLM-DE-V01)_ relevant, um das Live-Image mÃ¶glichst klein zu halten. Dazu lÃ¶schen Sie alle Dateien und Verzeichnisse aus dem Verzeichnis ``squashfs/usr/share/backgrounds/`` und kopieren Sie dort nur Euer individuelles Hintergrundbild.


Sie kÃ¶nnen das Hintergrundbild fÃ¼r die Desktopsitzung fÃ¼r alle Benutzer festlegen. Generieren Sie dazu in dem Verzeichnis `squashfs/etc/skel/.config/autostart` eine neue Datei mit der `.desktop` Erweiterung an. Das Kommando in dieser Datei wird beim Start der Gnome Sitzung automatisch ausgefÃ¼hrt. Falls nicht vorhanden, muss das Verzeichnis `squashfs/etc/skel/.config/autostart` zuerst angelegt werden.

```
~/TRuDI_LiveCD$ sudo chroot squashfs mkdir /etc/skel/.config
~/TRuDI_LiveCD$ sudo chroot squashfs mkdir /etc/skel/.config/autostart
~/TRuDI_LiveCD$ sudo nano squashfs/etc/skel/.config/autostart/set_background.desktop
```

Die soll folgenden Inhalt haben:

```
[Desktop Entry]
Type=Application
Name=TRuDI Hintergrundbild
Exec=gsettings set org.gnome.desktop.background picture-uri 'file:///usr/share/backgrounds/trudi_background.png'
X-GNOME-Autostart-enabled=true
```

__Wichtig:__ Dieser Schritt sollte vor dem Anlegen des Testbenutzers gemacht werden. Der Testbenutzer kann aber einfach gelÃ¶scht und neu angelegt werden. Benutzen Sie zum LÃ¶schen folgendes Kommando:

```
~/TRuDI_LiveCD$ sudo chroot squashfs deluser --remove-home trudi
```

Man kann auch das Aussehen der BenutzeroberflÃ¤che fÃ¼r die Benutzeranmeldung anpassen, indem man eigenen Hintergrund und eigenes Logo verwendet.

Das Hintergrundbild und Logo sollten in Verzeichnisse ``squashfs/usr/share/backgrounds/``, 
bzw.  ``squashfs/usr/share/unity-greeter/`` kopiert werden. Ã„ndern Sie dann die folgende Datei:

```
~/TRuDI_LiveCD$ sudo nano squashfs/usr/share/glib-2.0/schemas/10_unity_greeter_background.gschema.override
```

Der Dateiinhalt sollte folgendermaÃŸen aussehen:

```
[com.canonical.unity-greeter]
draw-user-backgrounds=false
background='/usr/share/backgrounds/trudi_background.png'
logo='/usr/share/unity-greeter/trudi_greeter_logo.png'
```

## ISO-Image Fertigstellen

Erstellen Sie nun das ISO-Image wie folgt. Das Ergebnis ist eine neue Datei namens _live.iso_ in Ihrem Arbeitsverzeichnis: 

```
~/TRuDI_LiveCD$ sudo chroot squashfs update-initramfs -k all -c
~/TRuDI_LiveCD$ sudo zcat squashfs/boot/initrd.img* | lzma -9c > iso/casper/initrd.lz
~/TRuDI_LiveCD$ sudo cp squashfs/boot/vmlinuz* iso/casper/vmlinuz.efi
~/TRuDI_LiveCD$ sudo umount squashfs/dev/pts squashfs/dev squashfs/proc squashfs/sys
~/TRuDI_LiveCD$ sudo rm squashfs/etc/resolv.conf 
~/TRuDI_LiveCD$ sudo mksquashfs squashfs iso/casper/filesystem.squashfs -noappend
~/TRuDI_LiveCD$ sudo genisoimage -cache-inodes -r -J -l -b isolinux/isolinux.bin -c isolinux/boot.cat -no-emul-boot -boot-load-size 4 -boot-info-table -eltorito-alt-boot -e boot/grub/efi.img -no-emul-boot -o live.iso iso
```

## Hinweise fÃ¼r die Erstellung eines Live-USB Mediums

Damit das ISO-Image immer von der USB starten kann, erzeugen Sie ein _Hybrid_-Image daraus:

```
~/TRuDI_LiveCD$ sudo isohybrid --uefi --verbose live.iso
```

Danach wird empfohlen, das Hybrid-Image auf das USB-Medium zu __klonen__. DafÃ¼r kÃ¶nnen Sie das Programm _mkusb_ direkt von ihrem Ubuntu Host-Rechner benutzen.
Sie kÃ¶nnen zwar Programme wie das _Unetbootin_ verwenden, um das Image auf das USB-Medium zu Ã¼bertragen. Das _Unetbootin_ benÃ¶tigt sogar das Hybrid-Image nicht, sondern Sie kÃ¶nnen ein normales ISO-Image auf das USB-Medium damit Ã¼bertragen. Nachteil von diesen Programmen ist, dass Sie meistens einen eigenen Bootloader anlegen, und damit nicht weiter sichergestellt ist was in dem Absatz: **_Bootvorgang und Laden der rechtlich relevanten Software_** _(PTB-8.51-MB08-BSLM-DE-V01)_ gefordert wird.
