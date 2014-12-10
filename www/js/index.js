/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

document.addEventListener('deviceready', function() { app.initialize(); }, false);
easyble = evothings.easyble;
var app = {};

app.devices = {};
app.connected = false;

 // RBL Board Capability
app.totalPinCount = 0;
app.pin_digital = {};
app.pin_analog = {};
app.pin_pwm = {};
app.pin_servo = {};
app.pin_mode = {};
app.pin_cap = {};

app.RBL_SERVICE_UUID = '713d0000-503e-4c75-ba94-3148f18d941e';
app.RBL_CHAR_TX_UUID = '713d0002-503e-4c75-ba94-3148f18d941e';
app.RBL_CHAR_RX_UUID = '713d0003-503e-4c75-ba94-3148f18d941e';
app.RBL_TX_UUID_DESCRIPTOR = '00002902-0000-1000-8000-00805f9b34fb';

// UI
var bleList = null;
var connectButton = null;
var disconnectButton = null;
var controlList = null;

app.initialize = function() {
    app.connected = false;
    bleList = $('ul#bleList');
    connectButton = $('a#connectButton');
    disconnectButton = $('a#disconnectButton');
    controlList = $('ul#controlList');
    disconnectButton.hide();
};

app.connectBtn = function() {
    connectButton.hide();
    app.startScan();

};

app.startScan = function() {

    app.disconnect();

    console.log('Scanning started..');

    app.devices = {};

    function onScanSuccess(device) {

        if (app.devices[device.address]) {
            return;
        }
        app.devices[device.address] = device;
        console.log('Found: ' + device.name + ', ' + device.address);
      //  success(device);
        bleList.append('<li><a href="#" onclick="app.connectTo(\'' + device.address + '\')">' + device.name + ', ' + device.address + '</a></li>').listview('refresh');

    };

    function onScanFail(errorCode) {
        app.disconnect();
        navigator.notification.alert('Error: ' + errorCode, function() {});

        console.log('Error ' + errorCode);
    };

    easyble.startScan(onScanSuccess, onScanFail);
};

app.connectTo = function(address) {

    device = app.devices[address];

    function onConnectSuccess(device) {
        $.mobile.loading('show', {});
        function onServiceSuccess(device) {

                // Application is now connected
            app.connected = true;
            app.device = device;

            console.log('Connected to ' + device.name);

            device.writeDescriptor(
                app.RBL_CHAR_TX_UUID, 
                app.RBL_TX_UUID_DESCRIPTOR,
                new Uint8Array([1,0]),
                function()
                {
                    console.log('Status: writeDescriptor ok.');
                },
                function(errorCode)
                {
                    // Disconnect and give user feedback. 
                    app.disconnect('Failed to set descriptor.');

                    // Write debug information to console.
                    console.log('Error: writeDescriptor: ' + errorCode + '.');
                });


                device.enableNotification(app.RBL_CHAR_TX_UUID, 
                    app.receivedData, 
                    function(errorCode){console.log('BLE enableNotification error: ' + errorCode);});
                $.mobile.loading('hide');
                $.mobile.changePage('#control');
                $.mobile.loading('show', {});
                connectButton.hide();
                disconnectButton.show();
            };

            function onServiceFailure(errorCode) {

                // Disconnect and show an error message to the user.
                app.disconnect();

                // Write debug information to console.
                console.log('Error reading services: ' + errorCode);
            };

            // Connect to the appropriate BLE service
            device.readServices([app.RBL_SERVICE_UUID], onServiceSuccess, onServiceFailure);

           
    };

    function onConnectFailure(errorCode) {

            // Disconnect and show an error message to the user.
            app.disconnect('Disconnected from device');

            // Write debug information to console
            console.log('Error ' + errorCode);
    };

    // Stop scanning
    easyble.stopScan();

    // Connect to our device
    console.log('Identifying service for communication');
    device.connect(onConnectSuccess, onConnectFailure);

};

// Send

app.sendData = function(data) {

    if (app.connected) {

        function onMessageSendSuccess() {
            console.log('Succeded to send message');
        };

        function onMessageSendFail(errorCode) {
            console.log('Fail to send data with error: ' + errorCode);
            app.disconnect('Fail to send data');
        };

        //data = new Uint8Array(data);

        app.device.writeCharacteristic(app.RBL_CHAR_RX_UUID, 
            new Uint8Array(data), 
            onMessageSendSuccess, onMessageSendFail);

    }
    else {
        app.disconnect('Error');
        console.log('Error - No device connected.');
    }

}

app.sendCustomData = function(data) {

    var buf = [0x5a, data.length];
    buf.concat(data);
    app.sendData(buf);

};

app.queryPinAll = function() {
    var buf = [0x41];
    app.sendData(buf);
};

app.queryProtocolVersion = function() {
    var buf = [0x56];
    app.sendData(buf);
};

app.queryTotalPinCount = function() {

    var buf = [0x43];
    app.sendData(buf);
};

app.queryPinCapability = function(pin) {

    var buf = [0x50, pin];
    app.sendData(buf);
};

app.queryPinMode = function(pin) {

    var buf = [0x4d, pin];
    app.sendData(buf);
};

app.analogWrite = function(pin, value) {

    var buf = [0x4e, pin, value];
    app.sendData(buf);
};

app.servoWrite = function(pin, value) {
    var buf = [0x4f, pin, value];
    app.sendData(buf);
};

app.digitalRead = function(pin) {
    var buf = [0x47, pin];
    app.sendData(buf);
};

app.digitalWrite = function(pin, value) {
    var buf = [0x54, pin, value];
    app.sendData(buf);
};


app.setPinMode = function(pin, mode) {
    var buf = [0x53, pin, mode];
    app.sendData(buf);
};



// Receive 
app.receivedData = function(data) {
    if (app.connected) {
        var data = new Uint8Array(data);
        var i=0;
        while (i < data.length) {
            
            var type = data[i++]; 
           //  controlList.append('<li>' + type + '</li>').listview('refresh');
                
            switch (type) {
                case 0x56: 
                    app.didReceiveProtocolVersion(data[i++], data[i++], data[i++]);
                    break; 
                case 0x43: 
                    app.didReceiveTotalPinCount(data[i++]);
                    break;
                case 0x50: 
                    app.didReceivePinCapability(data[i++], data[i++]);
                    break;
                case 0x5a:
                    app.didReceiveCustomData(data.subarray(i), data.length-i);
                    i = data.length;
                    break;
                case 0x4d: 
                    app.didReceivePinMode(data[i++], data[i++]);
                    break;
                case 0x47: 
                    app.didReceivePinData(data[i++], data[i++], data[i++]);
                    break;
            };
        }

    }
    else {
        app.disconnect();

        console.log('Error - No device connected');
    }

};

app.didReceiveProtocolVersion = function(major, minor, bugfix) {
    console.log('Receive Protocol Version: ' + major + '.' + minor + '.' + bugfix);
   
    app.sendCustomData([0x42, 0x4c, 0x45]);
    app.queryTotalPinCount();
    
};

app.didReceiveTotalPinCount = function(count) {
    console.log('Receive Pin Count: ' + count);
    
    app.totalPinCount = count;
    app.queryPinAll();
    
};

app.didReceivePinCapability = function(pin, value) {
    console.log('Receive Pin Capability: pin ' + pin + ',value:' + value); 
    app.pin_cap[pin] = value;
    if (app.pin_cap[pin] == 0) 
        return;

    var html = '<li id="pin_' + pin + '"><div class="ui-grid-a"><div class="ui-block-a">Pin ' + pin +'</div><div class="ui-block-b"></div></div>';
    
    html += '<div class="ui-grid-a"><div id="pin_mode" class="ui-block-a">';

    html += '<select id="select-' + pin + '" data-role="none" data-mini="true">';
    if (app.pin_cap[pin] & 0x01) {
        html += '<option value="0">Input</option>';
        html += '<option value="1">Output</option>';
    }
    if (app.pin_cap[pin] & 0x02) {
        html += '<option value="2">Analog</option>';
    }
    if (app.pin_cap[pin] & 0x04) {
        html += '<option value="3">PWM</option>';
    }
    if (app.pin_cap[pin] & 0x08) {
        html += '<option value="4">Servo</option>';
    }
    html += '</select>';

    html += '</div><div id="pin_value" class="ui-block-b"></div></div></li>';
    controlList.append(html);
    $('select[id|="select"]').selectmenu();
    controlList.listview('refresh');
};

app.didReceiveCustomData = function(data, length) {
   
    // ABC received pin ready
    if (data.length == 3 && data[0] == 0x41 && data[1] == 0x42 && data[2] == 0x43) { 
        $.mobile.loading('hide');  
       // navigator.notification.alert('Load Done', function alertDismissed() {});
   }
};

app.didReceivePinMode = function(pin, mode) {
    console.log('Receive Pin Mode: ' + pin + ' ' + mode);

    app.pin_mode[pin] = mode;
};


app.didReceivePinData = function(pin, mode, value) {
    console.log('Receive Pin Data: ' + pin + ' ' + mode + ' ' + value);

    var pin_value = $('li#pin_' + pin + ' div#pin_value');
    var pin_mode = $('li#pin_' + pin + ' div#pin_mode select');
    var _mode = mode & 0x0F;

    var inputoutputHtml = '<select name="flip-' + pin + '" id="flip-' + pin + '" data-role="slider">' +
                          '<option value="0">Off</option><option value="1">On</option></select>'; 

    app.pin_mode[pin] = _mode;
     switch(_mode) {
        case 0x00: // INPUT 
            app.pin_digital[pin] = value;
            pin_mode.val(0).attr('selected', true).siblings('option').removeAttr('selected');
                     break;
        case 0x01: // OUTPUT  
            app.pin_digital[pin] = value;
           
            pin_mode.val(1).attr('selected', true).siblings('option').removeAttr('selected');
            break;
        case 0x02:
            app.pin_analog[pin] = ((mode >> 4) << 8) + value;
            pin_mode.val(2).attr('selected', true).siblings('option').removeAttr('selected');
            break;
        case 0x03:
            app.pin_pwm[pin] = value;
            pin_mode.val(3).attr('selected', true).siblings('option').removeAttr('selected');
            break;
        case 0x04:
            app.pin_servo[pin] = value;
            pin_mode.val(4).attr('selected', true).siblings('option').removeAttr('selected');
            break;
    };
    pin_mode.selectmenu('refresh', true);

    // if change mode
    pin_mode.change(function() {
        app.setPinMode(pin, pin_mode.val());
    });

    if (_mode == 0x00 || _mode == 0x01) {
        pin_value.empty();
        pin_value.append(inputoutputHtml);
        var selectPin = pin_value.find('select#flip-' + pin);
        selectPin.val(value).attr('selected', true).siblings('option').removeAttr('selected');
        selectPin.slider();
        if (_mode == 0x00) {
            selectPin.slider('disable');
        }
        else {
            selectPin.change(function() {
            
                app.digitalWrite(pin, selectPin.val());
            });
        }
    
    } 
    else if (_mode == 0x02) {
        pin_value.empty();
        pin_value.append('<input type="text" id="analog-' + pin + '" data-mini="true" size="6" readonly value="' + app.pin_analog[pin] + '" />');
    }
    else if (_mode == 0x03) {
        pin_value.empty();
        pin_value.append('<input type="range" id="pwm-' + pin + '" min="0" max="255" value="' + value + '" />');
        var changePWM = pin_value.find('input#pwm-' + pin);
        changePWM.change(function() {


            app.analogWrite(pin, changePWM.val());
        });
    }
    else if (_mode == 0x04) {
        pin_value.empty();
        pin_value.append('<input type="range" id="servo-' + pin + '" min="0" max="180" value="' + value + '" />');
        var changeServo = pin_value.find('input#servo-' + pin);
        changeServo.change(function() {
            app.servoWrite(pin, changeServo.val());
        });
    }

};


app.disconnect = function(errorMessage) {

    if(errorMessage) {

        navigator.notification.alert(errorMessage,function alertDismissed() {});
    }
    app.connected = false;
    app.device = null;
    bleList.empty();
    easyble.stopScan();
    controlList.empty();
    easyble.closeConnectedDevices();
    connectButton.show();
    disconnectButton.hide();

    console.log('Disconnected');
};

// Page Event
$('#control').on('pageshow', function() {
    if (app.connected) {
              app.queryProtocolVersion();
    }
});

//app.initialize();

