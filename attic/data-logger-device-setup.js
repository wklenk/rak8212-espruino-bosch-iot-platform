/*
  data-logger-device-setup.js - Toolbox for self-registration of a device at the Bosch IoT Hub.

  Copyright (C) 2019 Wolfgang Klenk <wolfgang.klenk@gmail.com>

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var at;
var deviceId;

// NB1 connectivity settings for 1NCE
/*
var connection_options = {
  band: "B8",
  apn: "iot.1nce.net",
  operator: "26201",
  debug: true
};
*/

// NB1 connectivity settings for Vodafone Germany
var connection_options = {
  band: "B20",
  apn: "vgesace.nb.iot",
  operator: "26202",
  debug: true // Print communication with BG96 module to console.
};

// Secret individual binding credentials of the IoT Hub Service
var binding_credentials = {
  "tenant-id": "t720acea8ea3d40c0a87287bc99b93a98",
  "account-reference": "720acea8-ea3d-40c0-a872-87bc99b93a98",
  "ssl-certificate": "https://docs.bosch-iot-hub.com/cert/iothub.crt",
  "adapters": [{
    "type": "http",
    "telemetry-endpoint": "https://http.bosch-iot-hub.com/telemetry",
    "event-endpoint": "https://http.bosch-iot-hub.com/event"
  }, {
    "type": "mqtt",
    "endpoint": "mqtt.bosch-iot-hub.com",
    "port": "8883",
    "telemetry-endpoint": "telemetry",
    "event-endpoint": "event"
  }],
  "messaging": {
    "endpoint": "messaging.bosch-iot-hub.com",
    "port": "5671",
    "username": "messaging@t720acea8ea3d40c0a87287bc99b93a98",
    "password": "c6y05Fbowisf8WIEEgoW"
  },
  "device-registry": {
    "registration-endpoint": "https://device-registry.bosch-iot-hub.com/registration/t720acea8ea3d40c0a87287bc99b93a98",
    "credentials-endpoint": "https://device-registry.bosch-iot-hub.com/credentials/t720acea8ea3d40c0a87287bc99b93a98",
    "username": "device-registry@t720acea8ea3d40c0a87287bc99b93a98",
    "password": "EFLUOKhPx0ESxU0w1omQ"
  }
};

var band_values = {
  "B1": "1",
  "B2": "2",
  "B3": "4",
  "B4": "8",
  "B5": "10",
  "B8": "80",
  "B12": "800",
  "B13": "1000",
  "B18": "20000",
  "B19": "40000",
  "B20": "80000",
  "B26": "2000000",
  "B28": "8000000"
};

sendAtCommand = function (command, timeoutMs) {
  return new Promise(function (resolve, reject) {

    var answer = "";
    at.cmd(command + "\r\n", timeoutMs || 1E3, function processResponse(response) {
      if (undefined === response || "ERROR" === response || response.startsWith("+CME ERROR")) {
        reject(response ? (command + ": " + response) : (command + ": TIMEOUT"));
      } else if ("OK" === response || "SEND OK" === response) {
        resolve(answer);
      } else {
        return answer += (answer ? "\n" : "") + response, processResponse;
      }
    });
  });
};

sendAtCommandAndWaitForConnect = function (command, timeoutMs, sendLineAfterPrompt) {
  return new Promise(function (resolve, reject) {

    var answer = "";

    if (sendLineAfterPrompt) {
      at.register('CONNECT', function (line) {
        at.unregister('CONNECT');
        console.log("Sending", JSON.stringify(sendLineAfterPrompt));
        at.write(sendLineAfterPrompt);

        return line.substr('CONNECT\r\n'.length);
      });
    }

    at.cmd(command + "\r\n", timeoutMs, function processResponse(response) {
      if (undefined === response || "ERROR" === response || response.startsWith("+CME ERROR")) {
        reject(response ? (command + ": " + response) : (command + ": TIMEOUT"));
      } else if ("OK" === response || "SEND OK" === response) {
        resolve(answer);
      } else {
        answer += (answer ? "\n" : "") + response;
        return processResponse;
      }
    });
  });
};

// TODO: Timeout
waitForLine = function (lineBeginningToWaitFor) {
  return new Promise(function (resolve, reject) {
    at.unregisterLine(lineBeginningToWaitFor);
    at.registerLine(lineBeginningToWaitFor, function (line) {
      resolve(line);
    });
  });
};

// Setup BG96 module
function setupExternalHardware() {
  return new Promise(function (resolve, reject) {
    console.log("Connecting BG96 module ...");
    require("iTracker").setCellOn(true, function (usart) {
      console.log("BG96 module connected.");
      at = require("AT").connect(usart);

      if (connection_options.debug) {
        at.debug(true);
      }

      resolve();
    });
  });
}

function setupConnection() {

  return sendAtCommand('AT&F0')
    .then(() => sendAtCommand('ATE0'))
    // Fails on locked PIN
    .then(() => sendAtCommand('AT+CPIN?'))
    // Request International Mobile Equipment Identity (IMEI)
    .then(() => sendAtCommand('AT+GSN'))
    .then((imei) => {
      deviceId = imei;
      console.log('device-id:', imei);
      var band_value = band_values[connection_options.band];
      if (undefined === band_value) throw("Unknown band: " + connection_options.band);

      return sendAtCommand('AT+QCFG="band",0,0,' + band_value + ',1');
    })
    // Network Search Mode, LTE only
    .then(() => sendAtCommand('AT+QCFG="nwscanmode",3,1'))
    // Network Search Sequence, NB-Iot, GSM, CatM1
    .then(() => sendAtCommand('AT+QCFG="nwscanseq",030102,1'))
    // LTE Search Mode: NB-IoT only
    .then(() => sendAtCommand('AT+QCFG="iotopmode",1,1'))
    // Set PS domain, PS only
    .then(() => sendAtCommand('AT+QCFG="servicedomain",1,1'))
    .then(() => sendAtCommand('AT+CGDCONT=1,"IP",' + JSON.stringify(connection_options.apn))
    .then(() => sendAtCommand('AT+CFUN=1'))
    // Manually register to network.
    // Modem LED should flash on-off-off-off periodically to indicate network search
    .then(() => sendAtCommand('AT+COPS=1,2,' + JSON.stringify(connection_options.operator) + ',9', 180000))
    // Configure representation of Network Registration Status:
    //Enable network registration and location information unsolicited result code.
    .then(() => sendAtCommand('AT+CEREG=2'))
    // Query Network Registration Status
    // Response: +CEREG: 2,<stat>,<tac>,<?>,<ci>,<AcT>
    // <stat> should be 1 (Registered, home network) or 5 (Registered, roaming)
    // <AcT> should be 9 (LTE Cat NB1)
    .then(() => sendAtCommand('AT+CEREG?'))
    // Configure Parameters of a TCP/IP Context
    .then(() => sendAtCommand('AT+QICSGP=1,1,' + JSON.stringify(connection_options.apn) + ',"","",1 '))
    // Activate context 1. Maximum response time is 150s
    .then(() => sendAtCommand('AT+QIACT=1', 150000))
    // Query the state of the context.
    // This will return the assigned IP address.
    .then(() => sendAtCommand('AT+QIACT?'))
    // Configure the PDP context ID as 1.
    .then(() => sendAtCommand('AT+QHTTPCFG="contextid",1'))
    // Allow to output HTTP response header.
    .then(() => sendAtCommand('AT+QHTTPCFG="responseheader",1'))
    // Use custom request headers.
    .then(() => sendAtCommand('AT+QHTTPCFG="requestheader",1')));
}


function tearDownConnection() {

  // Deactivate context 1
  return sendAtCommand('AT+QIDEACT=1')
    // Power down BG96 module
    .then(() => sendAtCommand('AT+QPOWD'));
}

// HTTP GET Request on /registration/{tenant-id}/{device-id}
function getDeviceRegistration() {

  // Set URL of resource to request.
  var urlRegistration = binding_credentials["device-registry"]["registration-endpoint"] + '/' + deviceId;
  console.log('Registration URL:', urlRegistration);

  return sendAtCommandAndWaitForConnect('AT+QHTTPURL=' + urlRegistration.length, 10000, urlRegistration)
    .then(function () {
      // Send HTTP GET request.
      var urlParts = url.parse(urlRegistration);
      var headers = 'GET ' + urlParts.path + ' HTTP/1.1'
        + '\r\n'
        + 'Host: ' + urlParts.host
        + '\r\n'
        + 'Authorization: Basic '
        + btoa(binding_credentials["device-registry"]["username"] + ":" + binding_credentials["device-registry"]["password"])
        + '\r\n'
        + 'Accept: application/json'
        + '\r\n'
        + 'User-Agent: Quectel BG96 module on RAK8212'
        + '\r\n'
        + '\r\n'; // Additional empty line to mark end of headers

      return sendAtCommandAndWaitForConnect(
        'AT+QHTTPGET=60,' + headers.length,
        60000,
        headers);
    })
    .then(() => waitForLine('+QHTTPGET'))
    .then((line) => {
      console.log('+QHTTPGET response line:', line);

      // Returns something like "+QHTTPGET: 0,404,0"
      var responseValues = line.substr(10).split(',');
      var errorCode = parseInt(responseValues[0], 10);
      var httpResponseCode = parseInt(responseValues[1], 10);
      var contentLength = parseInt(responseValues[2], 10);
      console.log('Error code:', errorCode, 'HTTP response code:', httpResponseCode, 'Content length:', contentLength);

      if (contentLength > 0) {
        return sendAtCommand('AT+QHTTPREAD=80');
      } else {
        return httpResponseCode;
      }
    });
}

// HTTP POST Request on /registration/{tenant-id}
function postDeviceRegistration() {

  // Set URL of resource to request.
  var urlRegistration = binding_credentials["device-registry"]["registration-endpoint"];
  console.log('Registration URL:', urlRegistration);

  return sendAtCommandAndWaitForConnect('AT+QHTTPURL=' + urlRegistration.length, 10000, urlRegistration)
    // Send HTTP POST request.
    .then(() => {
      var body = '{ "device-id": "' + deviceId + '", "enabled": true }';

      var urlParts = url.parse(urlRegistration);
      var headers = 'POST ' + urlParts.path + ' HTTP/1.1'
        + '\r\n'
        + 'Host: ' + urlParts.host
        + '\r\n'
        + 'Authorization: Basic '
        + btoa(binding_credentials["device-registry"]["username"] + ":" + binding_credentials["device-registry"]["password"])
        + '\r\n'
        + 'Accept: application/json'
        + '\r\n'
        + 'Content-Type: application/json'
        + '\r\n'
        + 'Content-Length: ' + body.length
        + '\r\n'
        + 'User-Agent: Quectel BG96 module on RAK8212'
        + '\r\n'
        + '\r\n'; // Additional empty line to mark end of headers

      console.log('now sending post request', headers);
      return sendAtCommandAndWaitForConnect(
        'AT+QHTTPPOST=' + (headers.length + body.length),
        60000,
        headers + body);
    })
    .then(() => waitForLine('+QHTTPPOST'))
    .then((line) => {
      console.log('+QHTTPPOST response line:', line);

      // Returns something like "+QHTTPPOST: 0,201,0"
      var responseValues = line.substr(11).split(',');
      var errorCode = parseInt(responseValues[0], 10);
      var httpResponseCode = parseInt(responseValues[1], 10);
      var contentLength = parseInt(responseValues[2], 10);
      console.log('Error code:', errorCode, 'HTTP response code:', httpResponseCode, 'Content length:', contentLength);

      if (contentLength > 0) {
        return sendAtCommand('AT+QHTTPREAD=80');
      } else {
        return httpResponseCode;
      }
    });
}

// HTTP DELETE Request on /registration/{tenant-id}/{device-id}
function deleteDeviceRegistration() {

  // Set URL of resource to request.
  var urlRegistration = binding_credentials["device-registry"]["registration-endpoint"] + '/' + deviceId;
  console.log('Registration URL:', urlRegistration);

  return sendAtCommandAndWaitForConnect('AT+QHTTPURL=' + urlRegistration.length, 10000, urlRegistration)
    // Send HTTP DELETE request.
    .then(() => {
      var urlParts = url.parse(urlRegistration);
      var headers = 'DELETE ' + urlParts.path + ' HTTP/1.1'
        + '\r\n'
        + 'Host: ' + urlParts.host
        + '\r\n'
        + 'Authorization: Basic '
        + btoa(binding_credentials["device-registry"]["username"] + ":" + binding_credentials["device-registry"]["password"])
        + '\r\n'
        + 'Accept: application/json'
        + '\r\n'
        + 'User-Agent: Quectel BG96 module on RAK8212'
        + '\r\n'
        + '\r\n'; // Additional empty line to mark end of headers

      return sendAtCommandAndWaitForConnect(
        'AT+QHTTPGET=60,' + headers.length,
        60000,
        headers);
    })
    .then(() => waitForLine('+QHTTPGET'))
    .then((line) => {
      console.log('+QHTTPGET response line:', line);

      // Returns something like "+QHTTPGET: 0,404,0"
      var responseValues = line.substr(10).split(',');
      var errorCode = parseInt(responseValues[0], 10);
      var httpResponseCode = parseInt(responseValues[1], 10);
      var contentLength = parseInt(responseValues[2], 10);
      console.log('Error code:', errorCode, 'HTTP response code:', httpResponseCode, 'Content length:', contentLength);

      if (contentLength > 0) {
        return sendAtCommand('AT+QHTTPREAD=80');
      } else {
        return httpResponseCode;
      }
    });
}

// HTTP GET Request on /credentials/{tenant-id}
// Let auth-id be the same as device-id
function getDeviceCredentials() {

  // Set URL of resource to request.
  var urlCredentials = binding_credentials["device-registry"]["credentials-endpoint"]
    + '?auth-id=' + deviceId + '&type=hashed-password';
  console.log('Credentials URL:', urlCredentials);

  return sendAtCommandAndWaitForConnect('AT+QHTTPURL=' + urlCredentials.length, 10000, urlCredentials)
    // Send HTTP GET request.
    .then(() =>  {
      var urlParts = url.parse(urlCredentials);
      var headers = 'GET ' + urlParts.path + ' HTTP/1.1'
        + '\r\n'
        + 'Host: ' + urlParts.host
        + '\r\n'
        + 'Authorization: Basic '
        + btoa(binding_credentials["device-registry"]["username"] + ":" + binding_credentials["device-registry"]["password"])
        + '\r\n'
        + 'Accept: application/json'
        + '\r\n'
        + 'User-Agent: Quectel BG96 module on RAK8212'
        + '\r\n'
        + '\r\n'; // Additional empty line to mark end of headers

      return sendAtCommandAndWaitForConnect(
        'AT+QHTTPGET=60,' + headers.length,
        60000,
        headers);
    })
    .then(() => waitForLine('+QHTTPGET'))
    .then((line) => {
      console.log('+QHTTPGET response line:', line);

      // Returns something like "+QHTTPGET: 0,404,0"
      var responseValues = line.substr(10).split(',');
      var errorCode = parseInt(responseValues[0], 10);
      var httpResponseCode = parseInt(responseValues[1], 10);
      var contentLength = parseInt(responseValues[2], 10);
      console.log('Error code:', errorCode, 'HTTP response code:', httpResponseCode, 'Content length:', contentLength);

      if (contentLength > 0) {
        return sendAtCommand('AT+QHTTPREAD=80');
      } else {
        return httpResponseCode;
      }
    });
}

// HTTP POST Request on /credentials/{tenant-id}
// Let auth-id be the same as device-id
function postDeviceCredentials() {

  // Set URL of resource to request.
  var urlCredentials = binding_credentials["device-registry"]["credentials-endpoint"];
  console.log('Registration URL:', urlCredentials);

  return sendAtCommandAndWaitForConnect('AT+QHTTPURL=' + urlCredentials.length, 10000, urlCredentials)
    // Send HTTP POST request.
    .then(() => {
      var body = '{'
        + '"device-id": "' + deviceId + '",'
        + '"type": "hashed-password",'
        + '"auth-id": "' + deviceId + '",'
        + '"enabled": true,'
        + '"secrets": ['
        + '{'
        + '  "password": "secret"' // Password is "secret"
        + '}'
        + ']'
        + '}';

      var urlParts = url.parse(urlCredentials);
      var headers = 'POST ' + urlParts.path + ' HTTP/1.1'
        + '\r\n'
        + 'Host: ' + urlParts.host
        + '\r\n'
        + 'Authorization: Basic '
        + btoa(binding_credentials["device-registry"]["username"] + ":" + binding_credentials["device-registry"]["password"])
        + '\r\n'
        + 'Accept: application/json'
        + '\r\n'
        + 'Content-Type: application/json'
        + '\r\n'
        + 'Content-Length: ' + body.length
        + '\r\n'
        + 'User-Agent: Quectel BG96 module on RAK8212'
        + '\r\n'
        + '\r\n'; // Additional empty line to mark end of headers

      console.log('now sending post request', headers);
      return sendAtCommandAndWaitForConnect(
        'AT+QHTTPPOST=' + (headers.length + body.length),
        60000,
        headers + body);
    })
    .then(() => waitForLine('+QHTTPPOST'))
    .then((line) => {
      console.log('+QHTTPPOST response line:', line);

      // Returns something like "+QHTTPPOST: 0,201,0"
      var responseValues = line.substr(11).split(',');
      var errorCode = parseInt(responseValues[0], 10);
      var httpResponseCode = parseInt(responseValues[1], 10);
      var contentLength = parseInt(responseValues[2], 10);
      console.log('Error code:', errorCode, 'HTTP response code:', httpResponseCode, 'Content length:', contentLength);

      if (contentLength > 0) {
        return sendAtCommand('AT+QHTTPREAD=80');
      } else {
        return httpResponseCode;
      }
    });
}

// HTTP DELETE Request on /credentials/{tenant-id}
// Let auth-id be the same as device-id
function deleteDeviceCredentials() {

  // Set URL of resource to request.
  var urlCredentials = binding_credentials["device-registry"]["credentials-endpoint"]
    + '?auth-id=' + deviceId + '&type=hashed-password';
  console.log('Credentials URL:', urlCredentials);

  return sendAtCommandAndWaitForConnect('AT+QHTTPURL=' + urlCredentials.length, 10000, urlCredentials)
    // Send HTTP DELETE request.
    .then(() => {
      var urlParts = url.parse(urlCredentials);
      var headers = 'DELETE ' + urlParts.path + ' HTTP/1.1'
        + '\r\n'
        + 'Host: ' + urlParts.host
        + '\r\n'
        + 'Authorization: Basic '
        + btoa(binding_credentials["device-registry"]["username"] + ":" + binding_credentials["device-registry"]["password"])
        + '\r\n'
        + 'Accept: application/json'
        + '\r\n'
        + 'User-Agent: Quectel BG96 module on RAK8212'
        + '\r\n'
        + '\r\n'; // Additional empty line to mark end of headers

      return sendAtCommandAndWaitForConnect(
        'AT+QHTTPGET=60,' + headers.length,
        60000,
        headers);
    })
    .then(() => waitForLine('+QHTTPGET'))
    .then((line) => {
      console.log('+QHTTPGET response line:', line);

      // Returns something like "+QHTTPGET: 0,404,0"
      var responseValues = line.substr(10).split(',');
      var errorCode = parseInt(responseValues[0], 10);
      var httpResponseCode = parseInt(responseValues[1], 10);
      var contentLength = parseInt(responseValues[2], 10);
      console.log('Error code:', errorCode, 'HTTP response code:', httpResponseCode, 'Content length:', contentLength);

      if (contentLength > 0) {
        return sendAtCommand('AT+QHTTPREAD=80');
      } else {
        return httpResponseCode;
      }
    });
}



function checkRegistration() {
  setupExternalHardware()
    .then(() => setupConnection())
    .then(() => getDeviceRegistration())
    .then(() => tearDownConnection())
    .then(() => printMenu());
}

function createRegistration() {
  setupExternalHardware()
    .then(() => setupConnection())
    .then(() => postDeviceRegistration())
    .then(() => tearDownConnection())
    .then(() => printMenu());
}

function deleteRegistration() {
  setupExternalHardware()
    .then(() => setupConnection())
    .then(() => deleteDeviceRegistration())
    .then(() => tearDownConnection())
    .then(() => printMenu());
}

function checkCredentials() {
  setupExternalHardware()
    .then(() => setupConnection())
    .then(() => getDeviceCredentials())
    .then(() => tearDownConnection())
    .then(() => printMenu());
}

function createCredentials() {
  setupExternalHardware()
    .then(() => setupConnection())
    .then(() => postDeviceCredentials())
    .then(() => tearDownConnection())
    .then(() => printMenu());
}

function deleteCredentials() {
  setupExternalHardware()
    .then(() => setupConnection())
    .then(() => deleteDeviceCredentials())
    .then(() => tearDownConnection())
    .then(() => printMenu());
}

function getOAuth2Token() {
  setupExternalHardware()
    .then(() => setupConnection())
    .then(() => getDeviceOAuth2Token())
    .then(() => tearDownConnection())
    .then(() => printMenu());
}

function printMenu() {
  console.log('\n');
  console.log('Device self-registration Toolbox');
  console.log('--------------------------------');
  console.log('Choose one of:');
  console.log('checkRegistration();  - To check if the device is already registered.');
  console.log('createRegistration(); - To register the device.');
  console.log('deleteRegistration(); - To unregister the device.');
  console.log('checkCredentials();   - To check if the device already has credentials.');
  console.log('createCredentials();  - To create credentials for the device.');
  console.log('deleteCredentials();  - To delete the credentials of the device.');
}

function onInit() {
  Bluetooth.setConsole(true); // Don't want to have console on "Serial1" that is used for modem.
  printMenu();
}
