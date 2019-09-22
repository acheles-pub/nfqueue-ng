let http = require('http');

const OK_TEXT = "OK";
const BAD_TEXT = "ВСЕ ПЛОХО!";
const API_CONTROL_URL = '/api/device/control';
const API_NET_MODE_URL = '/api/net/net-mode';
const API_SESS_TOK_URL = '/api/webserver/SesTokInfo';
const API_DEVICE_INFORMATION_URL = '/api/device/information';
const DEFAULT_NETWORK_BAND = '3FFFFFFF'; // All supported
const DEFAULT_LTE_BAND = '7FFFFFFFFFFFFFFF'; // All band
const DEFAULT_CONTENT_TYPE = 'text/xml';

const rebootRequest = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><request><Control>1</Control></request>";
const changeNetworkModeRequest = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><request><NetworkMode>NMode</NetworkMode><NetworkBand>NBand</NetworkBand><LTEBand>LBand</LTEBand></request>";

const modemNumberTemplate = "192.168.modemNumber.1";

const numberPattern = /modemNumber/gm;
const netModeParsePattern = /.*\r\n.*\r\n.*<NetworkMode>(.*)<.*\r\n.*<NetworkBand>(.*)<.*\r\n.*<LTEBand>(.*)<.*\r\n.*\r\n/gm;
const sessIdAndTokParsePattern = /.*?\r\n.*?\r\n*?.*?SessionID=(\S+)<.+\s+<TokInfo>(\S+)<.*?\r\n.+\r\n/gm;

// const NetworkModes = {
//     ALL: '00',
//     ONLY_2G: '01',
//     ONLY_3G: '02',
//     ONLY_4G: '03',
//     NO_CHANGES: '99'
// };

const toggleNetworkModes = {
    '00': '02',
    '02': '03',
    '03': '02'
};

class ModemHelper {

    static getSessionIdAndTokInfo(modemNumber) {
        return new Promise((resolve, reject) => {
            let modemAddress = ModemHelper.getModemAddressByNumber(modemNumber);
            let options = ModemHelper.getRequestOptions(modemAddress, API_SESS_TOK_URL, 'GET');
            ModemHelper.doHttpRequestToModem(options)
                .then(data => {
                    let sessId = data.replace(sessIdAndTokParsePattern, "\$1");
                    let tokInfo = data.replace(sessIdAndTokParsePattern, "\$2");
                    resolve([sessId, tokInfo]);
                }, error => reject([error.message, BAD_TEXT]));
        });
    }

    static getModemInfo(modemNumber, sessId, tokInfo) {
        return new Promise((resolve, reject) => {
            ModemHelper.getSessionIdAndTokInfo(modemNumber)
                .then(([sessId, tokInfo]) => {
                    ModemHelper.execModemInfo(modemNumber, sessId, tokInfo)
                        .then(resolve, reject)
                }, reject);
        });
    }

    static execModemInfo(modemNumber, sessId, tokInfo) {
        return new Promise((resolve, reject) => {
            let modemAddress = ModemHelper.getModemAddressByNumber(modemNumber);
            let options = ModemHelper.getRequestOptions(modemAddress, API_DEVICE_INFORMATION_URL, 'GET', sessId, tokInfo);
            ModemHelper.doHttpRequestToModem(options)
                .then(data => {
                    resolve(data);
                }, error => reject([error.message, BAD_TEXT]));
        });
    }

    static doReboot(modemNumber) {
        return new Promise((resolve, reject) => {
            ModemHelper.getSessionIdAndTokInfo(modemNumber)
                .then(([sessId, tokInfo]) => ModemHelper.execReboot(tokInfo, sessId, modemNumber), reject)
                .then(resolve, reject);
        });
    }

    static toggleNetworkMode(modemNumber) {
        return new Promise((resolve, reject) => {
            ModemHelper.getSessionIdAndTokInfo(modemNumber)
                .then(([sessId, tokInfo]) => {
                    ModemHelper.getCurrentNetworkMode(modemNumber, sessId, tokInfo)
                        .then(([networkMode]) => {
                            let newMode = toggleNetworkModes[networkMode];
                            ModemHelper.changeNetworkMode(modemNumber, sessId, tokInfo, newMode, DEFAULT_NETWORK_BAND, DEFAULT_LTE_BAND)
                                .then((data) => {
                                    let isOk = data.indexOf('<response>OK</response>') > -1;
                                    if (isOk) {
                                        ModemHelper.checkIpAddress(modemNumber).then(resolve, reject);
                                    } else {
                                        reject(data);
                                    }
                                });
                        }, reject)
                }, reject);
        });
    }

    static checkIpAddress(modemNumber) {
        return new Promise((resolve, reject) => {
            let wait = ms => new Promise(resolve => setTimeout(resolve, ms));

            let check = () => {
                return ModemHelper.getModemInfo(modemNumber)
                    .then((data) => {
                        const wanIPPattern = /WanIPAddress>(.+)<\/WanIPAddress/gm;
                        const workModePattern = /workmode>(.+)<\/workmode/gm;
                        let wanIPMatch = wanIPPattern.exec(data);
                        let workModeMatch = workModePattern.exec(data);
                        if (wanIPMatch && wanIPMatch.length > 1) {
                            return [data, workModeMatch[1], wanIPMatch[1]];
                        } else {
                            return wait(1000).then(check);
                        }
                    }, reject).then(resolve);
            };
            check();
        });
    }

    static getCurrentNetworkMode(modemNumber, sessId, tokInfo) {
        return new Promise((resolve, reject) => {
            let modemAddress = ModemHelper.getModemAddressByNumber(modemNumber);
            let options = ModemHelper.getRequestOptions(modemAddress, API_NET_MODE_URL, 'GET', sessId, tokInfo);
            ModemHelper.doHttpRequestToModem(options)
                .then(data => {
                    let networkMode = data.replace(netModeParsePattern, "\$1");
                    let networkBand = data.replace(netModeParsePattern, "\$2");
                    let LTEBand = data.replace(netModeParsePattern, "\$3");
                    resolve([networkMode, networkBand, LTEBand]);
                }, error => reject([error.message, BAD_TEXT]));
        });
    }

    static changeNetworkMode(modemNumber, sessId, tokInfo, networkMode, networkBand, LTEBand) {
        return new Promise((resolve, reject) => {
            let modemAddress = ModemHelper.getModemAddressByNumber(modemNumber);
            let changeModeRequest = changeNetworkModeRequest
                .replace('NMode', networkMode)
                .replace('NBand', networkBand)
                .replace('LBand', LTEBand);
            let options = ModemHelper.getRequestOptions(modemAddress, API_NET_MODE_URL, 'POST', sessId, tokInfo, changeModeRequest);
            ModemHelper.doHttpRequestToModem(options, changeModeRequest)
                .then(data => {
                    resolve(data);
                }, error => reject([error.message, BAD_TEXT]));
        });
    }

    static execReboot(tokInfo, sessId, modemNumber) {
        return new Promise((resolve, reject) => {
            let modemAddress = ModemHelper.getModemAddressByNumber(modemNumber);
            let options = ModemHelper.getRequestOptions(modemAddress, API_CONTROL_URL, 'POST', sessId, tokInfo, rebootRequest);
            ModemHelper.doHttpRequestToModem(options, rebootRequest)
                .then(data => {
                    let isOk = data.indexOf('<response>OK</response>') > -1;
                    resolve([data, isOk ? OK_TEXT : BAD_TEXT]);
                }, error => reject([error.message, BAD_TEXT]));
        });
    }

    static getRequestOptions(modemAddress, path, method, sessId, tokInfo, data, contentType) {
        let options = {
            hostname: modemAddress,
            port: 80,
            path: path,
            method: method,
            headers: {
                'Content-Type': contentType ? contentType : DEFAULT_CONTENT_TYPE
            }
        };
        if (sessId) options.headers['Cookie'] = 'SessionID=' + sessId;
        if (tokInfo) options.headers['__RequestVerificationToken'] = tokInfo;
        if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
        return options;
    }

    static doHttpRequestToModem(options, data) {
        return new Promise((resolve, reject) => {
            const req = http.request(options, (resp) => {
                let data = '';
                resp.setEncoding('utf8');
                resp.on('data', chunk => data += chunk);
                resp.on('end', () => resolve(data));
                resp.on("error", (err) => {
                    console.log("Error: " + err.message);
                    reject(err.message);
                });
            });
            if (data) req.write(data);
            req.end();
        });
    }

    static getModemAddressByNumber(modemNumber) {
        return modemNumberTemplate.replace(numberPattern, parseInt(modemNumber) + 1);
    }
}

module.exports = ModemHelper;
