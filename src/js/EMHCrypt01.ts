///<reference path="verifyInterfaces.ts" />
///<reference path="verifyLib.ts" />
///<reference path="ACrypt.ts" />


interface IEMHMeasurementValue extends IMeasurementValue
{
    infoStatus:                 string,
    secondsIndex:               number,
    paginationId:               string,
    logBookIndex:               string
}

interface IEMHCrypt01Result extends ICryptoResult
{
    sha256value?:                  any,
    meterId?:                      string,
    meter?:                        IMeter,
    timestamp?:                    string,
    infoStatus?:                   string,
    secondsIndex?:                 string,
    paginationId?:                 string,
    obis?:                         string,
    unitEncoded?:                  string,
    scale?:                        string,
    value?:                        string,
    logBookIndex?:                 string,
    authorizationStart?:           string,
    authorizationStop?:            string,
    authorizationStartTimestamp?:  string,
    publicKey?:                    string,
    publicKeyFormat?:              string,
    signature?:                    IECCSignature
}


class EMHCrypt01 extends ACrypt {

    readonly curve = new this.elliptic.ec('p192');
    
    constructor(GetMeter: GetMeterFunc) {
        super("ECC secp192r1",
              GetMeter);              
    }


    Sign(measurementValue:  IEMHMeasurementValue,
         privateKey:        any,
         publicKey:         any): IGDFCrypt01Result
    {

        // var keypair                      = this.curve.genKeyPair();
        //     privateKey                   = keypair.getPrivate();
        //     publicKey                    = keypair.getPublic();        
        // var privateKeyHEX                = privateKey.toString('hex').toLowerCase();
        // var publicKeyHEX                 = publicKey.encode('hex').toLowerCase();
        
        var buffer                       = new ArrayBuffer(320);
        var cryptoBuffer                 = new DataView(buffer);

        var cryptoResult:IEMHCrypt01Result = {
            status:                       VerificationResult.InvalidSignature,
            meterId:                      SetHex        (cryptoBuffer, measurementValue.measurement.energyMeterId,                                  0),
            timestamp:                    SetTimestamp32(cryptoBuffer, measurementValue.timestamp,                                                 10),
            infoStatus:                   SetHex        (cryptoBuffer, measurementValue.infoStatus,                                                14, false),
            secondsIndex:                 SetUInt32     (cryptoBuffer, measurementValue.secondsIndex,                                              15, true),
            paginationId:                 SetHex        (cryptoBuffer, measurementValue.paginationId,                                              19, true),
            obis:                         SetHex        (cryptoBuffer, measurementValue.measurement.obis,                                          23, false),
            unitEncoded:                  SetInt8       (cryptoBuffer, measurementValue.measurement.unitEncoded,                                   29),
            scale:                        SetInt8       (cryptoBuffer, measurementValue.measurement.scale,                                         30),
            value:                        SetUInt64     (cryptoBuffer, measurementValue.value,                                                     31, true),
            logBookIndex:                 SetHex        (cryptoBuffer, measurementValue.logBookIndex,                                              39, false),
            authorizationStart:           SetText       (cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"],     41),
            authorizationStartTimestamp:  SetTimestamp32(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart.timestamp, 169)
        };

        // Only the first 24 bytes/192 bits are used!
        cryptoResult.sha256value  = this.crypt.createHash ('sha256').
                                               update     (cryptoBuffer).
                                               digest     ('hex').
                                               toLowerCase().
                                               substring  (0, 48);

        cryptoResult.publicKey    = publicKey.encode('hex').
                                              toLowerCase();

        const signature           = this.curve.keyFromPrivate(privateKey.toString('hex')).
                                               sign(cryptoResult.sha256value);

        switch (measurementValue.measurement.signatureInfos.format)
        {

            case SignatureFormats.DER:

                cryptoResult.signature = {
                    algorithm:  measurementValue.measurement.signatureInfos.algorithm,
                    format:     measurementValue.measurement.signatureInfos.format,
                    value:      signature.toDER('hex')
                };

                return cryptoResult;


            case SignatureFormats.rs:

                cryptoResult.signature = {
                    algorithm:  measurementValue.measurement.signatureInfos.algorithm,
                    format:     measurementValue.measurement.signatureInfos.format,
                    r:          signature.r,
                    s:          signature.s
                };

                return cryptoResult;


            //default:


        }

        cryptoResult.status = VerificationResult.ValidSignature;
        return cryptoResult;

    }


    Verify(measurementValue:  IEMHMeasurementValue): IEMHCrypt01Result
    {

        function setResult(vr: VerificationResult)
        {
            cryptoResult.status     = vr;
            measurementValue.result = cryptoResult;
            return cryptoResult;
        }

        var buffer        = new ArrayBuffer(320);
        var cryptoBuffer  = new DataView(buffer);

        var cryptoResult:IEMHCrypt01Result = {
            status:                       VerificationResult.InvalidSignature,
            meterId:                      SetHex        (cryptoBuffer, measurementValue.measurement.energyMeterId,                                  0),
            timestamp:                    SetTimestamp32(cryptoBuffer, measurementValue.timestamp,                                                 10),
            infoStatus:                   SetHex        (cryptoBuffer, measurementValue.infoStatus,                                                14, false),
            secondsIndex:                 SetUInt32     (cryptoBuffer, measurementValue.secondsIndex,                                              15, true),
            paginationId:                 SetHex        (cryptoBuffer, measurementValue.paginationId,                                              19, true),
            obis:                         SetHex        (cryptoBuffer, measurementValue.measurement.obis,                                          23, false),
            unitEncoded:                  SetInt8       (cryptoBuffer, measurementValue.measurement.unitEncoded,                                   29),
            scale:                        SetInt8       (cryptoBuffer, measurementValue.measurement.scale,                                         30),
            value:                        SetUInt64     (cryptoBuffer, measurementValue.value,                                                     31, true),
            logBookIndex:                 SetHex        (cryptoBuffer, measurementValue.logBookIndex,                                              39, false),
            authorizationStart:           SetText       (cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart["@id"],     41),
            authorizationStartTimestamp:  SetTimestamp32(cryptoBuffer, measurementValue.measurement.chargingSession.authorizationStart.timestamp, 169)
        };

        var signatureExpected = measurementValue.signatures[0] as IECCSignature;
        if (signatureExpected != null)
        {

            try
            {

                cryptoResult.signature = {
                    algorithm:  measurementValue.measurement.signatureInfos.algorithm,
                    format:     measurementValue.measurement.signatureInfos.format,
                    r:          signatureExpected.r,
                    s:          signatureExpected.s
                };

                // Only the first 24 bytes/192 bits are used!
                cryptoResult.sha256value = this.crypt.createHash('sha256').
                                                      update(cryptoBuffer).
                                                      digest('hex').
                                                      substring(0, 48);


                const meter = this.GetMeter(measurementValue.measurement.energyMeterId);
                if (meter != null)
                {

                    cryptoResult.meter = meter;

                    var iPublicKey = meter.publicKeys[0] as IPublicKey;
                    if (iPublicKey != null)
                    {

                        try
                        {

                            cryptoResult.publicKey        = iPublicKey.value.toLowerCase();
                            cryptoResult.publicKeyFormat  = iPublicKey.format;

                            try
                            {

                                if (this.curve.keyFromPublic(cryptoResult.publicKey, 'hex').
                                               verify       (cryptoResult.sha256value,
                                                             cryptoResult.signature))
                                {
                                    return setResult(VerificationResult.ValidSignature);
                                }
                                
                                return setResult(VerificationResult.InvalidSignature);

                            }
                            catch (exception)
                            {
                                return setResult(VerificationResult.InvalidSignature);
                            }

                        }
                        catch (exception)
                        {
                            return setResult(VerificationResult.InvalidPublicKey);
                        }

                    }

                    else
                        return setResult(VerificationResult.PublicKeyNotFound);

                }

                else
                    return setResult(VerificationResult.EnergyMeterNotFound);

            }
            catch (exception)
            {
                return setResult(VerificationResult.InvalidSignature);
            }

        }

    }


    View(measurementValue:        IEMHMeasurementValue,
         infoDiv:                 HTMLDivElement,
         bufferValue:             HTMLDivElement,
         hashedBufferValue:       HTMLDivElement,
         publicKeyValue:          HTMLDivElement,
         signatureExpectedValue:  HTMLDivElement,
         signatureCheckValue:     HTMLDivElement)
    {

        const result    = measurementValue.result as IEMHCrypt01Result;

        const cryptoDiv = CreateDiv(infoDiv,   "row");
                          CreateDiv(cryptoDiv, "id",    "Kryptoverfahren");
                          CreateDiv(cryptoDiv, "value", "EMHCrypt01 (" + this.description + ")");

        hashedBufferValue.parentElement.children[0].innerHTML = "Hashed Puffer (SHA256, 24 bytes)";
 
        this.CreateLine("Zählernummer",             measurementValue.measurement.energyMeterId,                                result.meterId,                      infoDiv, bufferValue);
        this.CreateLine("Zeitstempel",              measurementValue.timestamp,                                                result.timestamp,                    infoDiv, bufferValue);
        this.CreateLine("Status",                   measurementValue.infoStatus,                                               result.infoStatus,                   infoDiv, bufferValue);
        this.CreateLine("Sekundenindex",            measurementValue.secondsIndex,                                             result.secondsIndex,                 infoDiv, bufferValue);
        this.CreateLine("Paginierung",              measurementValue.paginationId,                                             result.paginationId,                 infoDiv, bufferValue);
        this.CreateLine("OBIS-Kennzahl",            measurementValue.measurement.obis,                                         result.obis,                         infoDiv, bufferValue);
        this.CreateLine("Einheit (codiert)",        measurementValue.measurement.unitEncoded,                                  result.unitEncoded,                  infoDiv, bufferValue);
        this.CreateLine("Skalierung",               measurementValue.measurement.scale,                                        result.scale,                        infoDiv, bufferValue);
        this.CreateLine("Messwert",                 measurementValue.value + " Wh",                                            result.value,                        infoDiv, bufferValue);
        this.CreateLine("Logbuchindex",             measurementValue.logBookIndex,                                             result.logBookIndex,                 infoDiv, bufferValue);
        this.CreateLine("Autorisierung (Start)",    measurementValue.measurement.chargingSession.authorizationStart["@id"],    result.authorizationStart,           infoDiv, bufferValue);
        this.CreateLine("Autorisierungszeitpunkt",  measurementValue.measurement.chargingSession.authorizationStart.timestamp, result.authorizationStartTimestamp,  infoDiv, bufferValue);


        // Buffer
        bufferValue.parentElement.children[0].innerHTML = "Puffer (320 Bytes)";
        hashedBufferValue.innerHTML      = "0x" + result.sha256value;


        // Public Key
        publicKeyValue.parentElement.children[0].innerHTML = "Public Key";
        
        if (result.publicKeyFormat)
            publicKeyValue.parentElement.children[0].innerHTML += " (" + result.publicKeyFormat + ")";

        publicKeyValue.innerHTML         = "0x" + result.publicKey;


        // Signature
        signatureExpectedValue.parentElement.children[0].innerHTML = "Erwartete Signatur (" + result.signature.format + ")";

        if (result.signature.r && result.signature.s)
            signatureExpectedValue.innerHTML = "r: 0x" + result.signature.r.toLowerCase() + "<br />" + "s: 0x" + result.signature.s.toLowerCase();

        else if (result.signature.value)
            signatureExpectedValue.innerHTML = "0x" + result.signature.value.toLowerCase();


        // Result
        switch (result.status)
        {

            case VerificationResult.ValidSignature:
                signatureCheckValue.innerHTML = '<i class="fas fa-check-circle"></i><div id="description">Gültige Signatur</div>';
                break;

            default:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">' + result.status + '</div>';
                break;

        }


    }

}