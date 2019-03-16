# Chargy - Transparency Software for E-Mobility Applications

Chargy is a transparency software for secure and transparent e-mobility charging processes, as defined by the German "Eichrecht". The software allows you to verify the cryptographic signatures of energy measurements within charge detail records and comes with a couple of useful extentions to simplify the entire process for endusers and operators.

## Introduction and Goals

As a driver of electric vehicles you have to tacle a couple of well-known
challenges: Where and when do I charge my vehicle and will I receive a
correct invoice for this process? To solve these issues the German Eichrecht
defines a legal foundation how to measure time and energy in a trustworthy
way, how to sign and store these measurments via digital signatures and how
to send these data to the endusers. You can think of this as a digital
receipt of the charging time, amount of consumed energy and the resulting
costs. Later in time an enduser can use a so called "transparency software"
to verify the correctness of these receipts and to prove possible mistakes.

Although the high demands of correctness and transparency in e-mobility
charging seem to be obvious, surprisingly no Open Source transparency
software was available until now. By this the goal of transparency was
actually not achieved, as even experienced endusers can not distinguish
between a wrong receipt and bugs within a closed source transparency
software. In the same way the legal situation of consumers had not been
improved significantly.

## Scope of the work

It is the legal duty of a charging station vendor and operator to provide
all the required tools to verify a receipt. Chargy is a such a tool and
helps endusers to understand the origin and composition of all expenses
independend of their desktop computer and smart phones. For special
regulatory tasks even a special Chargy Linux-Live-DVD exists.

## Stakeholders

Roll | Description | Expectations                 
-- | -- | -- 
EV Drivers | | A common and vendor independent transparency and verification of their charging processes
Open Source Community | Initiative of GraphDefined, chargeIT mobility and Wiedergrün | Providing a standardised solution
PTB (Working Group 8.51 Metrology Software) | National Metrology Institute of the Federal Republic of Germany | Regulatory verification of the software
Charging Station Vendors | | Providing data and protocols for the verification of charging processes
Charging Station Operators | | Providing a common software for the verification of charging processes to their direct customers and e-mobility providers
E-Mobility Providers | | Providing a common software for the verification of charging processes to their customers

## Constraints

### Technical Constraints

Constraint | Description, Background                  
-- | -- 
Support of Linux-, Mac OS X and Windows-Desktop-Operating Systems | The software must run on Windows 10+ and Mac OS X. Aditionally it must run on Linux, in order to provide Live-DVD or USB-Stick. 
Support on iOS- and Android Smart Phone-Operating Systems | The software muss run on current iOS and Android smart phones.
Limited cryptography | Most charging station vendors only support a single elliptic curve cryptography algorithm, e.g. secp192r1 and export only public keys instead of digital certificates of charging stations.

### Regulatory Constraints

Constraint | Description, Background                  
-- | -- 
Frozen Versions | The cryptographic hash value of a specific version of the software is part of a legal document. Automatic updates without user interaction is not possible.
Smart Meter Regulations | Some charging station vendors implement their requirements via smart meters. Therefore additional regulatory requirements occur.
Accessibility | Charging station owners might be public sector bodies which have to support [EU directive 2016/2102](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32016L2102) on the accessibility of websites and mobile applications.

## Approach

By using the well-known frameworks [Apache Cordova](https://cordova.apache.org/)
and [Electron](https://electronjs.org) we created a platform independent and
Open Source transparency software. This software can process the (still) very
different data formats of different charging station providers and verify their
correctness by using cryptographic algorithms. Besides this, Chargy is the first
transparency software in the market which does not only implement the minimal
requirements of the German regulators like the Physikalisch-Technische
Bundesanstalt (PTB), but tries to put the enduser into the center of any
development. This means Chargy does not only show additional information
about charging stations, their geo coordinates, addresses, tariffs and
includes an issue tracker. This all is done to give the ev driver the best
experience, to help him evaluate the correctness of the charging process
and to support him when something seems to be wrong.

## Benefits of Chargy

1. Chargy comes with __*meta data*__. True charging transparency is more than just signed smart meter values. Chargy allows you to group multiple signed smart meter values to entire charging sessions and to add additional meta data like EVSE information, geo coordinates, tariffs, ... within your backend in order to improve the user experience for the ev drivers.
2. Chargy is __*secure*__. Chargy implements a public key infrastructure for managing certificates of smart meters, EVSEs, charging stations, charging station operators and e-mobility providers. By this the ev driver will always retrieve the correct public key to verify a charging process automatically and without complicated manual lookups in external databases.
3. Chargy is __*platform agnostic*__. The entire software is available for desktop and smart phone operating systems and .NET. If you want ports to other platforms or programming languages, we will support your efforts.
4. Chargy is __*Open Source*__. In contrast to other vendors in e-mobility, we belief that true transparency is only trustworthy if the entire process and the required software is open and reusable under a fair copyleft license (AGPL).
5. Chargy is __*open for your contributions*__. We currently support adapters for the protocols of different charging station vendors like chargeIT mobility, ABL (OCMF), chargepoint. The certification at the Physikalisch-Technische Bundesanstalt (PTB) is provided by chargeIT mobility. If you want to add your protocol or a protocol adapter feel free to read the contributor license agreement and to send us a pull request.
6. Chargy is __*white label*__. If you are a supporter of the Chargy project you can even use the entire software project under the free Apache 2.0 license. This allows you to create proprietary forks implementing your own corporate design or to include Chargy as a library within your existing application (This limitation was introduced to avoid discussions with too many black sheeps in the e-mobility market. We are sorry...).
7. Chargy is __*accessible*__. For public sector bodies Chargy fully supports the [EU directive 2016/2102](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32016L2102) on the accessibility of websites and mobile applications and provides a context-sensitive feedback-mechanism and methods for dispute resolution.


