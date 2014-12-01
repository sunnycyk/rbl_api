
//
// Copyright 2014, Sunny Cheung
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// RedBearLab Controller API
//                                               version: 0.3 - 2014-11-20
//

/*console.log = function(x) {
    navigator.notification.alert(x, function() {});
}*/
var rbl_api = (function() {

    // Main API Object
    var api = {};

    // Device that found during scan
    api.devices = {};

    // Setup API delegate
    api.delegate = null;

    // RBL Board Capability
    api.totalPinCount = 0;
    api.pin_digital = {};
    api.pin_analog = {};
    api.pin_pwm = {};
    api.pin_servo = {};
    api.pin_mode = {};
    api.pin_cap = {};

    // custom ErrorCode
    api.ERROR_CODE = 1234;

    api.connected = false;
    api.cuurentDevice = null;

    // Default RedBearLab Service and Charateristic UUID
    api.RBL_SERVICE_UUID = '713d0000-503e-4c75-ba94-3148f18d941e';
    api.RBL_CHAR_TX_UUID = '713d0002-503e-4c75-ba94-3148f18d941e';
    api.RBL_CHAR_RX_UUID = '713d0003-503e-4c75-ba94-3148f18d941e';
    api.RBL_TX_UUID_DESCRIPTOR = '00002902-0000-1000-8000-00805f9b34fb';

    // Start Scanning for Service
    api.startScan = function(success, fail) { 
        
        function onScanSuccess(device) {
            
            if (!api.devices[device.address]) {
                api.devices[device.address] = device;
            }

            success(device);
        };

        function onScanFail(errorCode) {
            fail(errorCode);
        };

        // must be a callback function
        if (success && fail) {
            api.disconnect();
            easyble.startScan(onScanSuccess, onScanFail);
        }
        else {
            console.log('Error: Wrong Parameters to function startScan');
        }

    };

    // set Delegate
    api.setDelegate = function(delegate) {
        api.delegate = delegate;
    };

    // Assign different service UUID
    api.setRBLUUID = function(serviceUUID, rxCharUUID, txCharUUID) {
        if (!api.connected) {
             api.RBL_SERVICE_UUID = serviceUUID;
            api.RBL_CHAR_TX_UUID = txCharUUID;
            api.RBL_CHAR_RX_UUID = rxCharUUID;
        }
        else {
            api.disconnect();
            console.log('Cannot set service UUID when device is connected');
        }
       
    };

    // Default receviceCallback function
    api.receviceCallback = function(data) {
        
        if (api.delegate && api.delegate.receiveCallback) {
            api.delegate.receiveCallback(data);   // custom call back function
        }
        else { // default RBL Controller protocol
            var data = new Uint8Array(data);

            var i=0;
            while (i < data.length) {

                var type = data[i++]; 
                
                switch (type) {
                    case 'V': 
                        api.didReceiveProtocolVersion(data[i++], data[i++], data[i++]);
                        break; 
                    case 'C': 
                        api.didReceiveTotalPinCount(data[i++]);
                        break;
                    case 'P': 
                        api.didReceivePinCapability(data[i++], data[i++]);
                        break;
                    case 'Z': 
                        api.didReceiveCustomData(data[i++], data[i++]);
                        break;
                    case 'M': 
                        api.didReceivePinMode(data[i++], data[i++]);
                        break;
                    case 'G': 
                        api.didReceivePinData(data[i++], data[i++], data[i++]);
                        break;
                };
            }
        }

    };

    // This function will be called whenever data is received
    api.recevieData = function(data) {
        if (api.connected) {
                api.receiveCallback(data);
        } 
        else {
            api.disconnect();
            console.log('Error - No Device connected');
        }
    }

    // Default Protocol for RBL 
    // Data Receive
    api.didReceiveProtocolVersion = function(major, minor, bugfix) {
        console.log('Receive Protocol Version: ' + major + '.' + minor + '.' + bugfix);
        if (api.delegate && api.delegate.didReceiveProtocolVersion) {
            api.delegate.didReceiveProtocolVersion(major, minor, bugfix);
        }
        else {
            api.sendCustomData(['B', 'L', 'E']);
            api.queryTotalPinCount();
        }
    };

    api.didReceiveTotalPinCount = function(count) {
        console.log('Receive Pin Count: ' + count);
        if (api.delegate && api.delegate.didReceiveTotalPinCount) {
            api.delegate.didReceiveTotalPinCount(count);
        }
        else {
            api.totalPinCount = count;
            api.queryPinAll();
        }
    };

    api.didReceivePinCapability = function(pin, value) {
        console.log('Receive Pin Capability: pin ' + pin + ',value:' + value);

        if (api.delegate  && api.delegate.didReceivePinCapability) {
            api.delegate.didReceivePinCapability(pin, value);
        }
        else {
            api.pin_cap[pin] = value;
        }
    };

    api.didReceiveCustomData = function(data, length) {
        console.log('Receive Custom Data:' + data) ;
        if (api.delegate && api.delegate.didReceiveCustomData) {
            api.delegate.didReceiveCustomData(data, length);
        }
        else { // usually delegate take care of this
            console.log(data);
        }
    };

    api.didReceivePinMode = function(pin, mode) {
        console.log('Receive Pin Mode: ' + pin + ' ' + mode);

        if (api.delegate && api.delegate.didReceivePinMode) {    
            api.delegate.didReceivePinMode(pin, mode);
        }
        else {
            api.pin_mode[pin] = mode;
        }
    };


    api.didReceivePinData = function(pin, mode, value) {
        console.log('Receive Pin Data: ' + pin + ' ' + mode + ' ' + value);
    
        if (api.delegate &&  api.delegate.didReceivePinData) {
            api.delegate.didReceivePinData(pin, mode, value);
        }
        else {
            var _mode = mode & 0x0F;

            api.pin_mode[pin] = mode;
            switch(_mode) {
                case 0x00: // INPUT
                case 0x01: // OUTPUT 
                    api.pin_digital[pin] = value;
                    break;
                case 0x02:
                    api.pin_analog[pin] = ((mode >> 4) << 8) + value;
                    break;
                case 0x03:
                    api.pin_pwm[pin] = value;
                    break;
                case 0x04:
                    api.pin_servo[pin] = value;
                    break;
            }
        };
    };


    // Send query
    api.sendCustomData = function(data) {

        var buf = ['Z', data.length];
        buf.concat(data);
        api.sendData(buf);

    };

    api.queryPinAll = function() {
        var buf = ['A'];
        api.sendData(buf);
    };

    api.queryProtocolVersion = function() {
        var buf = ['V'];
        api.sendData(buf);
    };

    api.queryTotalPinCount = function() {

        var buf = ['C'];
        api.sendData(buf);
    };

    api.queryPinCapability = function(pin) {

        var buf = ['P', pin];
        api.sendData(buf);
    };

    api.queryPinMode = function(pin) {

        var buf = ['M', pin];
        api.sendData(buf);
    };

    api.analogWrite = function(pin, value) {

        var buf = ['N', pin, value];
        api.sendData(buf);
    };

    api.servoWrite = function(pin, value) {
        var buf = ['O', pin, value];
        api.sendData(buf);
    };



     // UART 
    api.sendData = function(data) {
        
        if (api.connected) {

            function onMessageSendSuccess() {
                console.log('Succeded to send message.');
            };

            function onMessageSendFail(errorCode) {
                console.log('Fail to send data with error: ' + errorCode);
                api.disconnect();
            };

            api.currentDevice.writeCharacteristic(api.RBL_CHAR_RX_UUID, 
                new Uint8Array(data), 
                onMessageSendSuccess, 
                onMessageSendFail);

        }
        else {
            api.disconnect();
            console.log('Error - No Device connected');
        }
    }

    // Abstract layer for BLE connection
    // will connect to service and setup charaertastic
    api.connect = function(address, success, fail) {

        function onConnectSuccess(device) {

            function onServiceSuccess(device) {
                
                // Application is now connected
                api.connected = true;
                api.currentDevice = device;

                console.log('Connected to ' + device.name);

                device.writeDescriptor(api.RBL_CHAR_TX_UUID, 
                    api.RBL_TX_UUID_DESCRIPTOR,
                    new UInt8Array([1,0]),
                    function() {
                        console.log('Status: wrtieDescriptor ok.');
                       
                    },
                    function(errorCode) {
                        api.disconnect();
                        console.log('Error: writeDescriptor: ' + errorCode  + '.'); 
                        fail(errorCode);
                    });
                
                device.enableNotification(api.RBL_CHAR_TX_UUID, 
                    api.recevieData, 
                    function(errorCode) {
                        console.log('Error: BLE enableNotification error: ' + errorCode  + '.'); 
                    });

            };

            function onServiceFail(errorCode) {
                api.disconnect();
                console.log('Error: Reading Services: ' + errorCode  + '.'); 
                fail(errorCode);
            };
            device.readServices([api.RBL_SERVICE_UUID], onServiceSuccess, onServiceFail);
        
            success(device);
        };

        function onConnectFail(errorCode) {
            api.disconnect();
            fail(errorCode);
        };

        if (success && fail) {
            api.disconnect();
            var device = api.devices[address];
            device.connect(onConnectSuccess, onConnectFail);
        }
        else {
            console.log('Error: Wrong Parameters to function startScan');
        }
    };

   


    api.disconnect = function() {
        api.connected = false;
        api.currentDevice = null;
        easyble.stopScan();
        easyble.closeConnectedDevices();

        // reset RBL Board Capability
        api.totalPinCount = 0;
        api.pin_digital = {};
        api.pin_analog = {};
        api.pin_pwm = {};
        api.pin_servo = {};
        api.pin_mode = {};
        api.pin_cap = {};
    };



    return api;

})();