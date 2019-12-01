/** This implementation is for educaitonal purposes only
  * and should not be used in production for obvious reasons.
  * If you would like to contribute, you are more than welcome to.
  *
  * const GcompressedLE   = BigInt("A1455B334DF099DF30FC28A169A467E9E47075A90F7E650EB6B7A45C", 16);
  * const GunCompressedLE = BigInt("A1455B334DF099DF30FC28A169A467E9E47075A90F7E650EB6B7A45C7E089FED7FBA344282CAFBD6F7E319F7C0B0BD59E2CA4BDB556D61A5", 16);
  *
  * Actual curve: y^2 = x^3 + Acurve * x + Bcurve
  *
  **/

class secp224k1 {

    // Pcurve = 2**224 - 2**32 - 2**12 - 2**11 - 2**9 - 2**7 - 2**4 - 2**1 - 1 OR FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE FFFFE56D
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

    // Individual Transaction/Personal Information
    public privKey           = BigInt("0x0065A09645613C7793A6129544F0CE700CC4ED5E0D7369DD0DB50A0230");
    // publicKey: 04 + 0e63cfc97d998270f9f09a4f78f0e6d33bc6c7258a302e9cb5cb8b5b
    //                 2423b0caf3044e657c5af7e11a6967ce7c752023273bc79e1ab95768
    //                                                               1dce8d2ec6184caf0a971769fb1f7
    //public  privKey           = BigInt("0x00000000000000000000000000015B9526505DAAAED38515AAAED385"); // replace with any private key
    public  RandNum           = BigInt("00000000000000000000000000019373285210420739438520739434");   // replace with a truly random number
    // public  HashOfThingToSign = BigInt("86032112319101611046176971828093669637772856272766963803");   // the hash of your message/transaction



    constructor() {

        // console.log();
        // console.log("******* Public Key Generation *********");
        // console.log();
        // let PublicKey = this.ECmultiply(this.GPoint, this.privKey);
        // let Px = this.zfill(PublicKey[0].toString(16));
        // let Py = this.zfill(PublicKey[1].toString(16));
        // console.log("the private key:")
        // console.log( this.privKey.toString() + " (HEXADECIMAL)" );
        // console.log();
        // console.log("the uncompressed public key (NOT ADDRESS):");
        // console.log(PublicKey[0].toString(16) + PublicKey[1].toString(16));
        // console.log();
        // console.log("the uncompressed public key (HEX):");
        // console.log("04" + Px + Py);
        // console.log();
        // console.log("the official Public Key (Address) - compressed:");

        // if (this.modulo(PublicKey[1], this.Two) == this.One) {
        //     console.log("03" + Px);
        // } else {
        //     console.log("02" + Px);
        // }

        // console.log();
        // console.log("******* Signature Generation *********");
        // let RandSignPoint = this.ECmultiply(this.GPoint, this.RandNum);
        // let Sx  = this.zfill(RandSignPoint[0].toString(16));
        // let Sy  = this.zfill(RandSignPoint[1].toString(16));

        // let signatureR = this.modulo(RandSignPoint[0], this.N);
        // console.log("R", signatureR.toString());

        // let signatureS = this.modulo((this.HashOfThingToSign + signatureR^this.privKey)^(this.modInv(this.RandNum, this.N)), this.N);
        // console.log("S", signatureS.toString());
        // // s = ((HashOfThingToSign + r*privKey)*(modinv(RandNum,N))) % N; print "s =", s

        // console.log();
        // console.log("******* Signature Verification *********");

        // let w   = this.modInv(signatureS, this.N);
        // console.log("w", w.toString());

        // let u1  = this.ECmultiply(this.GPoint, this.modulo(this.HashOfThingToSign^w, this.N));
        // // let u1x = u1[0];
        // // let u1y = u1[1];

        // let u2  = this.ECmultiply(PublicKey,   this.modulo(signatureR^w,                      this.N));
        // // let u2x = u2[0];
        // // let u2y = u2[1];

        // let validation  = this.ECadd(u1, u2);
        // let validationX = validation[0];

        // console.log("Signature Verified", validationX==signatureR);

        // //module.exports = { PublicKeyGenerate };

    }

    public Sign(hash:        bigint,
                privateKey:  bigint)
    {

      let RandSignPoint  = this.ECmultiply(this.GPoint, this.RandNum);
      let r              = this.modulo(RandSignPoint[0], this.N);
      let s              = this.modulo((hash + r*privateKey) * (this.modInv(this.RandNum, this.N)), this.N);

      return [ r, s ];

    }

    public validate(hash:        bigint,
                    signatureR:  bigint,
                    signatureS:  bigint,
                    PublicKey:   Array<bigint>) : boolean
    {

        if (signatureR==this.Zero || signatureR>=this.N)
            throw "Invalid R";

        if (signatureS==this.Zero || signatureS>=this.N)
            throw "Invalid S";

        let w           = this.modInv(signatureS, this.N);
        let u1          = this.ECmultiply(this.GPoint, this.modulo(w * hash,       this.N));
        let u2          = this.ECmultiply(PublicKey,   this.modulo(w * signatureR, this.N));
        let validation  = this.ECadd(u1, u2);

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

      let lm   = BigInt(1),
          hm   = BigInt(0),
          high = n,
          low  = this.modulo(a, n);

      while (low > 1) {

          let ratio = high / low,
              nm    = hm   - (ratio*lm),
              newm  = high - (ratio*low);

          hm   = lm;
          lm   = nm;
          high = low;
          low  = newm;

      }

      return this.modulo(lm, n);

    }

    public ECadd(a: Array<bigint>, b: Array<bigint>) {

        let LamAdd = this.modulo((b[1]-a[1])*( this.modInv( b[0]-a[0] ) ), this.Pcurve);
        let x      = this.modulo((LamAdd*LamAdd)-a[0]-b[0], this.Pcurve);
        let y      = this.modulo((LamAdd*( a[0]-x )-a[1]),  this.Pcurve);

        // const LamAdd = modulo(b[1].minus(a[1]).times( modInv( b[0].minus(a[0]) ) ), Pcurve);
        // const x      = modulo(LamAdd.times(LamAdd).minus(a[0]).minus(b[0]), Pcurve);
        // const y      = modulo(LamAdd.times( a[0].minus(x) ).minus(a[1]), Pcurve);

        return [x, y];

    }

    public ECdouble(a: Array<bigint>) {

        let Lam = this.modulo((((a[0]*a[0])*this.Three) + this.Acurve)*( this.modInv( a[1]*this.Two )), this.Pcurve);
        let x   = this.modulo((Lam*Lam)-(a[0]*this.Two),  this.Pcurve);
        let y   = this.modulo( Lam*( a[0]-x )-a[1],       this.Pcurve);

        // const Lam = this.modulo(a[0].times(a[0]).times(3).add(this.Acurve).times( this.modInv( a[1].times(2) ) ), this.Pcurve);
        // const x   = this.modulo(Lam.times(Lam).minus(a[0].times(2)), this.Pcurve);
        // const y   = this.modulo(Lam.times( a[0].minus(x) ).minus(a[1]), this.Pcurve);

        return [x, y];

    }

    public ECmultiply(GenPoint: Array<bigint>, ScalarHex: bigint) {

        if (ScalarHex==this.Zero || ScalarHex>=this.N)
             throw "Invalid Scalar/Private Key";

        let ScalarBinary = ScalarHex.toString(2);
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
    public PublicKeyGenerate(PrivateKey: string | number | bigint) : bigint[] {

        if (typeof PrivateKey === 'number')
            PrivateKey = BigInt(PrivateKey);

        if (typeof PrivateKey === 'string')
            PrivateKey = BigInt(PrivateKey);

        let PublicKey     = this.ECmultiply(this.GPoint, this.privKey);
        let Px            = this.zfill(PublicKey[0].toString(16));
        let Py            = this.zfill(PublicKey[1].toString(16));

        let uncompressed  = PublicKey[0].toString(16) + PublicKey[1].toString(16);
        let compressed    = "04" + Px + Py;
        let address       = (this.modulo(PublicKey[1], this.Two) == this.One)
                                ? "03" + Px
                                : "02" + Px;
        let xy            = [ Px, Py ];

        return [ PublicKey[0], PublicKey[1] ];

        // return {
        //     uncompressed,
        //     compressed,
        //     address,
        //     xy
        // };

    }


}
