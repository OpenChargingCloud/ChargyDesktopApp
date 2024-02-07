# Command Line Interface

If you want to use Chargy within automatic tests or within scripts you can use the command line interface mode:

```
C:\Program Files\Chargy Transparenzsoftware ChargePoint Edition>
Chargy Transparenzsoftware ChargePoint Edition v1.2.0
(c) 2018-2024 GraphDefined GmbH

Usage: Chargy Transparenzsoftware ChargePoint Edition.exe [switches] file1, file2, ...

Switches:
 --help             Show this information
 --debug            Run in debug modus and open development tools
 --nogui            Run in command line modus (cli mode)
```

A simple example how to validate a single charging session:

```
C:\Program Files\Chargy Transparenzsoftware>"Chargy Transparenzsoftware.exe" --nogui documentation\Alfen\ALFEN-Testdatensatz-10_chargeITContainer.chargy
Valid signature
```

If you need to use more than one file:

```
C:\Program Files\Chargy Transparenzsoftware>"Chargy Transparenzsoftware.exe" --nogui documentation\ChargePoint\Testdata-2020-02\0024b1000002e300_2_123017065_payload.tar.bz2 documentation\ChargePoint\Testdata-2020-02\0024b1000002e300_2.pem
Valid signature
```
