/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
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
  */

export class secp224k1 {

    // Pcurve = 2**224 - 2**32 - 2**12 - 2**11 - 2**9 - 2**7 - 2**4 - 2**1 - 1 or
    //          FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE FFFFE56D
    private Zero   = BigInt("0");
    private One    = BigInt("1");
    private Two    = BigInt("2");
    private Three  = BigInt("3");
    private Pcurve = BigInt("26959946667150639794667015087019630673637144422540572481099315275117"); // The proven prime
    private N      = BigInt("0x010000000000000000000000000001DCE8D2EC6184CAF0A971769FB1F7"); // Number of points in the field
    private Acurve = BigInt(0); // These two are defined on the elliptic curve. y^2 = x^3 + Acurve * x + Bcurve
    private Bcurve = BigInt(5); // These two are defined on the elliptic curve. y^2 = x^3 + Acurve * x + Bcurve
    private Gx     = BigInt("0xA1455B334DF099DF30FC28A169A467E9E47075A90F7E650EB6B7A45C");
    private Gy     = BigInt("0x7E089FED7FBA344282CAFBD6F7E319F7C0B0BD59E2CA4BDB556D61A5");
    private GPoint = [this.Gx, this.Gy]; // This is our generator point. Trillions of dif ones possible

    public Sign(hash:          bigint,
                RandomNumber:  bigint,
                privateKey:    bigint) : Array<bigint> | null
    {

        const RandSignPoint = this.ECmultiply(this.GPoint, RandomNumber);

        if (RandSignPoint.length >= 1 && RandSignPoint[0] != null)
        {

            const r = this.modulo(RandSignPoint[0], this.N);
            const s = this.modulo((hash + r*privateKey) * (this.modInv(RandomNumber, this.N)), this.N);

            return [ r, s ];

        }

        return null;

    }

    public validate(hash:        bigint,
                    signatureR:  bigint,
                    signatureS:  bigint,
                    PublicKey:   Array<bigint>) : boolean
    {

        if (signatureR == this.Zero || signatureR >= this.N)
            throw new Error("Invalid R");

        if (signatureS == this.Zero || signatureS >= this.N)
            throw new Error("Invalid S");

        const w           = this.modInv(signatureS, this.N);
        const u1          = this.ECmultiply(this.GPoint, this.modulo(w * hash,       this.N));
        const u2          = this.ECmultiply(PublicKey,   this.modulo(w * signatureR, this.N));
        const validation  = this.ECadd(u1, u2);

        return validation[0] == signatureR;

    }


    public modulo(n: bigint, m: bigint) {
        return (((n % m) + m) % m);
    }

    public zfill(s: string): string {

        while (s.length < 56) {
            s = "0" + s;
        }

        return s;

    }

    public modInv(a: bigint, n: bigint = this.Pcurve) {

      let lm    = BigInt(1),
          hm    = BigInt(0),
          high  = n,
          low   = this.modulo(a, n);

      while (low > 1) {

          const ratio = high / low,
              nm    = hm   - (ratio*lm),
              newm  = high - (ratio*low);

          hm    = lm;
          lm    = nm;
          high  = low;
          low   = newm;

      }

      return this.modulo(lm, n);

    }

    public ECadd(a: Array<bigint>,
                 b: Array<bigint>) : Array<bigint>
    {

        if (a[0] != undefined && b[0] != undefined &&
            a[1] != undefined && b[1] != undefined)
        {

            const LamAdd  = this.modulo((b[1]-a[1])*( this.modInv( b[0]-a[0] ) ), this.Pcurve);
            const x       = this.modulo((LamAdd*LamAdd)-a[0]-b[0], this.Pcurve);
            const y       = this.modulo((LamAdd*( a[0]-x )-a[1]),  this.Pcurve);

            return [x, y];

        }

        throw new Error("Invalid EC Point Addition!");

    }

    public ECdouble(a: Array<bigint>) : Array<bigint>
    {

        if (a[0] != undefined &&
            a[1] != undefined)
        {

            const Lam  = this.modulo((((a[0]*a[0])*this.Three) + this.Acurve)*( this.modInv( a[1]*this.Two )), this.Pcurve);
            const x    = this.modulo((Lam*Lam)-(a[0]*this.Two),  this.Pcurve);
            const y    = this.modulo( Lam*( a[0]-x )-a[1],       this.Pcurve);

            return [x, y];

        }

        throw new Error("Invalid EC Point Doubling!");

    }

    public ECmultiply(GenPoint:   Array<bigint>,
                      ScalarHex:  bigint) : Array<bigint>
    {

        if (ScalarHex == this.Zero || ScalarHex >= this.N)
             throw new Error("Invalid Scalar/Private Key");

        const ScalarBinary = ScalarHex.toString(2);
        let Q            = GenPoint;

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
    public PublicKeyGenerate(PrivateKey: string | number | bigint)
        : {
              x:             bigint,
              y:             bigint,
              xy:            Array<string>,
              uncompressed:  string,
              compressed:    string,
              address:       string
          } |
          undefined
    {

        if (typeof PrivateKey === 'number')
            PrivateKey = BigInt(PrivateKey);

        if (typeof PrivateKey === 'string')
            PrivateKey = BigInt(PrivateKey);

        const publicKey = this.ECmultiply(this.GPoint, PrivateKey);

        if (publicKey[0] !== undefined &&
            publicKey[1] !== undefined)
        {

            const Px = this.zfill(publicKey[0].toString(16));
            const Py = this.zfill(publicKey[1].toString(16));

            return {
                x:             publicKey[0],
                y:             publicKey[1],
                xy:            [Px, Py],
                uncompressed:  publicKey[0].toString(16) + publicKey[1].toString(16),
                compressed:    "04" + Px + Py,
                address:       (this.modulo(publicKey[1], this.Two) == this.One)
                                      ? "03" + Px
                                      : "02" + Px
            };

        }

    }

}
