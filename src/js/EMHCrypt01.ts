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
    sha256value?:               any,
    meterId?:                   string,
    meter?:                     IMeter,
    timestamp?:                 string,
    infoStatus?:                string,
    secondsIndex?:              string,
    paginationId?:              string,
    obis?:                      string,
    unitEncoded?:               string,
    scale?:                     string,
    value?:                     string,
    logBookIndex?:              string,
    authorization?:             string,
    authorizationTimestamp?:    string,
    publicKey?:                 string,
    signature?:                 IECCSignature
}


class EMHCrypt01 extends ACrypt {

    readonly curve = new this.elliptic.ec('p192');
    
    constructor(GetMeter: GetMeterFunc) {
        super("ECC secp192r1",
              GetMeter);              
    }


    Calc(measurementValue:  IEMHMeasurementValue): IEMHCrypt01Result
    {

        var buffer                       = new ArrayBuffer(320);
        var cryptoBuffer                 = new DataView(buffer);

        var cryptoData:IEMHCrypt01Result = {
            status:                       "unknown",
            meterId:                      SetHex        (cryptoBuffer, measurementValue.measurement.energyMeterId,                             0),
            timestamp:                    SetTimestamp32(cryptoBuffer, measurementValue.timestamp,                                            10),
            infoStatus:                   SetHex        (cryptoBuffer, measurementValue.infoStatus,                                           14, false),
            secondsIndex:                 SetUInt32     (cryptoBuffer, measurementValue.secondsIndex,                                         15, true),
            paginationId:                 SetHex        (cryptoBuffer, measurementValue.paginationId,                                         19, true),
            obis:                         SetHex        (cryptoBuffer, measurementValue.measurement.obis,                                     23, false),
            unitEncoded:                  SetInt8       (cryptoBuffer, measurementValue.measurement.unitEncoded,                              29),
            scale:                        SetInt8       (cryptoBuffer, measurementValue.measurement.scale,                                    30),
            value:                        SetUInt64     (cryptoBuffer, measurementValue.value,                                                31, true),
            logBookIndex:                 SetHex        (cryptoBuffer, measurementValue.logBookIndex,                                         39, false),
            authorization:                SetText       (cryptoBuffer, measurementValue.measurement.chargingSession.authorization["@id"],     41),
            authorizationTimestamp:       SetTimestamp32(cryptoBuffer, measurementValue.measurement.chargingSession.authorization.timestamp, 169)
        };

        var signatureExpected = measurementValue.signatures[0] as IECCSignature;
        if (signatureExpected != null)
        {

            cryptoData.signature = {
                                      algorithm:  signatureExpected.algorithm,
                                      format:     signatureExpected.format,
                                      r:          signatureExpected.r,
                                      s:          signatureExpected.s
                                   };

            try
            {

                var entireHash: string = this.crypt.createHash('sha256').
                                                    update(cryptoBuffer).
                                                    digest('hex');

                // Only the first 24 bytes/192 bits are used!
                cryptoData.sha256value = entireHash.substring(0, 48);


                var meter = this.GetMeter(measurementValue.measurement.energyMeterId);
                if (meter != null)
                {

                    cryptoData.meter = meter;

                    var iPublicKey = meter.publicKeys[0] as IPublicKey;
                    if (iPublicKey != null)
                    {

                        try
                        {

                            cryptoData.publicKey = iPublicKey.value.toLowerCase();

                            try
                            {

                                var result = this.curve.keyFromPublic(cryptoData.publicKey, 'hex').
                                                        verify(cryptoData.sha256value,
                                                               cryptoData.signature);

                                if (result)
                                {
                                    cryptoData.status = "verified";
                                    return cryptoData;
                                }

                                else
                                {
                                    cryptoData.status = "invalid signature";
                                    return cryptoData;
                                }

                            }
                            catch (exception)
                            {
                                cryptoData.status = "invalid signature";
                                return cryptoData;
                            }

                        }
                        catch (exception)
                        {
                            cryptoData.status = "invalid public key";
                            return cryptoData;
                        }

                    }

                    else
                        return { status: "no public key found" };

                }

                else
                    return { status: "energy meter not found" }

            }
            catch (exception)
            {
                return { status: "invalid signature" };
            }

        }

    }


    View(measurementValue:        IEMHMeasurementValue,
         result:                  IEMHCrypt01Result,
         infoDiv:                 HTMLDivElement,
         bufferValue:             HTMLDivElement,
         hashedBufferValue:       HTMLDivElement,
         publicKeyValue:          HTMLDivElement,
         signatureExpectedValue:  HTMLDivElement,
         signatureCheckValue:     HTMLDivElement)
    {

        var cryptoDiv = CreateDiv(infoDiv,   "row");
                        CreateDiv(cryptoDiv, "id",    "Kryptoverfahren");
                        CreateDiv(cryptoDiv, "value", "EMHCrypt01 (" + this.description + ")");

        hashedBufferValue.parentElement.children[0].innerHTML = "Hashed Puffer (SHA256, 24 bytes)";
 
        this.CreateLine("Zählernummer",               measurementValue.measurement.energyMeterId,                           result.meterId,                 infoDiv, bufferValue);
        this.CreateLine("Zeitstempel",                measurementValue.timestamp,                                           result.timestamp,               infoDiv, bufferValue);
        this.CreateLine("Status",                     measurementValue.infoStatus,                                          result.infoStatus,              infoDiv, bufferValue);
        this.CreateLine("Sekundenindex",              measurementValue.secondsIndex,                                        result.secondsIndex,            infoDiv, bufferValue);
        this.CreateLine("Paginierung",                measurementValue.paginationId,                                        result.paginationId,            infoDiv, bufferValue);
        this.CreateLine("OBIS-Kennzahl",              measurementValue.measurement.obis,                                    result.obis,                    infoDiv, bufferValue);
        this.CreateLine("Einheit (codiert)",          measurementValue.measurement.unitEncoded,                             result.unitEncoded,             infoDiv, bufferValue);
        this.CreateLine("Skalierung",                 measurementValue.measurement.scale,                                   result.scale,                   infoDiv, bufferValue);
        this.CreateLine("Messwert",                   measurementValue.value + " Wh",                                       result.value,                   infoDiv, bufferValue);
        this.CreateLine("Logbuchindex",               measurementValue.logBookIndex,                                        result.logBookIndex,            infoDiv, bufferValue);
        this.CreateLine("Autorisierung",              measurementValue.measurement.chargingSession.authorization["@id"],    result.authorization,           infoDiv, bufferValue);
        this.CreateLine("Zeitstempel Autorisierung",  measurementValue.measurement.chargingSession.authorization.timestamp, result.authorizationTimestamp,  infoDiv, bufferValue);

        hashedBufferValue.innerHTML      = "0x" + result.sha256value;
        publicKeyValue.innerHTML         = "0x" + result.publicKey;
        signatureExpectedValue.innerHTML = "0x" + result.signature;


        switch (result.status)
        {

            case "verified":
                signatureCheckValue.innerHTML = '<i class="fas fa-check-circle"></i><div id="description">Gültige Signatur</div>';
                break;

            default:
                signatureCheckValue.innerHTML = '<i class="fas fa-times-circle"></i><div id="description">' + result.status + '</div>';
                break;

        }


    }

}