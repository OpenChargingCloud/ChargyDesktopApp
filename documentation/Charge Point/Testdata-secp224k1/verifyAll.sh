#!/bin/bash

openssl dgst -sha256 -verify 0024b1000002e300_2.pem -signature 0024b1000002e300_2_119693895_payload/secrrct.sign 0024b1000002e300_2_119693895_payload/secrrct

openssl dgst -sha256 -verify 0024b10000027b29_1.pem -signature 0024b10000027b29_1_121708795_payload.FLAT_SESSION/secrrct.sign 0024b10000027b29_1_121708795_payload.FLAT_SESSION/secrrct

openssl dgst -sha256 -verify 0024b10000027b29_1.pem -signature 0024b10000027b29_1_121708845_payload.Per_Min/secrrct.sign 0024b10000027b29_1_121708845_payload.Per_Min/secrrct

openssl dgst -sha256 -verify 0024b10000027b29_1.pem -signature 0024b10000027b29_1_121709375_payload._Per_KWh/secrrct.sign 0024b10000027b29_1_121709375_payload._Per_KWh/secrrct

openssl dgst -sha256 -verify 0024b10000027b29_1.pem -signature 0024b10000027b29_1_121709405_payload_Min_Variation_/secrrct.sign 0024b10000027b29_1_121709405_payload_Min_Variation_/secrrct

openssl dgst -sha256 -verify 0024b10000027b29_1.pem -signature 0024b10000027b29_1_121709415_payload._TOU_/secrrct.sign 0024b10000027b29_1_121709415_payload._TOU_/secrrct

openssl dgst -sha256 -verify 0024b10000027b29_1.pem -signature 0024b10000027b29_1_121709465_payload_Parking_Tap_ToCharge/secrrct.sign 0024b10000027b29_1_121709465_payload_Parking_Tap_ToCharge/secrrct



