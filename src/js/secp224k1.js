"use strict";
/*
 * Copyright (c) 2018-2020 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy Desktop App <https://github.com/OpenChargingCloud/ChargyDesktopApp>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/*
 * Based on: https://github.com/CraigglesO/elliptic-curve-signature-algo
 *
 * This implementation is for educaitonal purposes only
 * and should not be used in production for obvious reasons.
 * If you would like to contribute, you are more than welcome to.
 *
 * const GcompressedLE   = BigInt("0xA1455B334DF099DF30FC28A169A467E9E47075A90F7E650EB6B7A45C");
 * const GunCompressedLE = BigInt("0xA1455B334DF099DF30FC28A169A467E9E47075A90F7E650EB6B7A45C7E089FED7FBA344282CAFBD6F7E319F7C0B0BD59E2CA4BDB556D61A5");
 *
 * Actual curve: y^2 = x^3 + Acurve * x + Bcurve
 *
 */
class secp224k1 {
    constructor() {
        // Pcurve = 2**224 - 2**32 - 2**12 - 2**11 - 2**9 - 2**7 - 2**4 - 2**1 - 1 or
        //          FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE FFFFE56D
        this.Zero = BigInt("0");
        this.One = BigInt("1");
        this.Two = BigInt("2");
        this.Three = BigInt("3");
        this.Pcurve = BigInt("26959946667150639794667015087019630673637144422540572481099315275117"); // The proven prime
        this.N = BigInt("0x010000000000000000000000000001DCE8D2EC6184CAF0A971769FB1F7"); // Number of points in the field
        this.Acurve = BigInt(0); // These two are defined on the elliptic curve. y^2 = x^3 + Acurve * x + Bcurve
        this.Bcurve = BigInt(5); // These two are defined on the elliptic curve. y^2 = x^3 + Acurve * x + Bcurve
        this.Gx = BigInt("0xA1455B334DF099DF30FC28A169A467E9E47075A90F7E650EB6B7A45C");
        this.Gy = BigInt("0x7E089FED7FBA344282CAFBD6F7E319F7C0B0BD59E2CA4BDB556D61A5");
        this.GPoint = [this.Gx, this.Gy]; // This is our generator point. Trillions of dif ones possible
    }
    Sign(hash, RandomNumber, privateKey) {
        let RandSignPoint = this.ECmultiply(this.GPoint, RandomNumber);
        let r = this.modulo(RandSignPoint[0], this.N);
        let s = this.modulo((hash + r * privateKey) * (this.modInv(RandomNumber, this.N)), this.N);
        return [r, s];
    }
    validate(hash, signatureR, signatureS, PublicKey) {
        if (signatureR == this.Zero || signatureR >= this.N)
            throw "Invalid R";
        if (signatureS == this.Zero || signatureS >= this.N)
            throw "Invalid S";
        let w = this.modInv(signatureS, this.N);
        let u1 = this.ECmultiply(this.GPoint, this.modulo(w * hash, this.N));
        let u2 = this.ECmultiply(PublicKey, this.modulo(w * signatureR, this.N));
        let validation = this.ECadd(u1, u2);
        return validation[0] == signatureR;
    }
    modulo(n, m) {
        return (((n % m) + m) % m);
    }
    zfill(s) {
        while (s.length < 56) {
            s = "0" + s;
        }
        return s;
    }
    modInv(a, n = this.Pcurve) {
        let lm = BigInt(1), hm = BigInt(0), high = n, low = this.modulo(a, n);
        while (low > 1) {
            let ratio = high / low, nm = hm - (ratio * lm), newm = high - (ratio * low);
            hm = lm;
            lm = nm;
            high = low;
            low = newm;
        }
        return this.modulo(lm, n);
    }
    ECadd(a, b) {
        let LamAdd = this.modulo((b[1] - a[1]) * (this.modInv(b[0] - a[0])), this.Pcurve);
        let x = this.modulo((LamAdd * LamAdd) - a[0] - b[0], this.Pcurve);
        let y = this.modulo((LamAdd * (a[0] - x) - a[1]), this.Pcurve);
        return [x, y];
    }
    ECdouble(a) {
        let Lam = this.modulo((((a[0] * a[0]) * this.Three) + this.Acurve) * (this.modInv(a[1] * this.Two)), this.Pcurve);
        let x = this.modulo((Lam * Lam) - (a[0] * this.Two), this.Pcurve);
        let y = this.modulo(Lam * (a[0] - x) - a[1], this.Pcurve);
        return [x, y];
    }
    ECmultiply(GenPoint, ScalarHex) {
        if (ScalarHex == this.Zero || ScalarHex >= this.N)
            throw "Invalid Scalar/Private Key";
        let ScalarBinary = ScalarHex.toString(2);
        let Q = GenPoint;
        for (let i = 1; i < ScalarBinary.length; i++) {
            Q = this.ECdouble(Q);
            if (ScalarBinary[i] === "1") {
                Q = this.ECadd(Q, GenPoint);
            }
        }
        return Q;
    }
    // uncompressed is the accumulation of both the x and y points
    // compressed is the public key to share in transactions
    // address is the public address tho whom someone can send coin
    PublicKeyGenerate(PrivateKey) {
        if (typeof PrivateKey === 'number')
            PrivateKey = BigInt(PrivateKey);
        if (typeof PrivateKey === 'string')
            PrivateKey = BigInt(PrivateKey);
        let PublicKey = this.ECmultiply(this.GPoint, PrivateKey);
        // let Px            = this.zfill(PublicKey[0].toString(16));
        // let Py            = this.zfill(PublicKey[1].toString(16));
        // let uncompressed  = PublicKey[0].toString(16) + PublicKey[1].toString(16);
        // let compressed    = "04" + Px + Py;
        // let address       = (this.modulo(PublicKey[1], this.Two) == this.One)
        //                         ? "03" + Px
        //                         : "02" + Px;
        // let xy            = [ Px, Py ];
        return [PublicKey[0], PublicKey[1]];
    }
}
//# sourceMappingURL=secp224k1.js.map