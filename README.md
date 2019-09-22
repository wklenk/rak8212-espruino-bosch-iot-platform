# rak8212-espruino-bosch-iot-platform
Example how to connect a RAK8212 device to the [Bosch IoT Suite](https://www.bosch-iot-suite.com/) Platform 
using the [Quectel BG96's](https://www.quectel.com/product/bg96.htm) built-in MQTT stack.

The example will be a simple data logger, periodically sending sensor
values using NB-IoT connectivity.

The [RAK8212](https://www.espruino.com/RAK8212) has quite a few sensors on board:

* Temperature
* Humidity
* Barometeric Pressure
* Ambient Light
* Accelerometer
* Magnetometer
* Location (GNSS)

## Assumptions
You are already familiar with the [RAK 8212](https://www.espruino.com/RAK8212) and how to
program it using [Espruino](https://www.espruino.com/).

## Preparations
This example uses the **Asset Communication** package of the **Bosch IoT Suite**.
There are quite a few things to configure before you can start, but there is an excellent
tutorial that describes the steps in detail:

https://www.bosch-iot-suite.com/tutorials/connecting-a-simple-device-to-the-bosch-iot-suite/#book-and-configure

What you need to do (steps described in the tutorial):

* Create a Bosch IoT Suite account
* Subscribe to the Bosch IoT Suite Asset Communications package
* Configure a namespace for your things (digital twins)
* Create and configure a technical OAuth2.0 client
* Generate a test token to access the APIs of the Bosch IoT Suite

## About Vorto Information Models

The IoT Suite gives you full freedom how to model the Digital Twin of your physical devices.
However, there is an open source project named "Eclipse Vorto" (https://vorto.eclipse.org) that allows
you to compose an **Information Model** of your device from several so-called **Function Blocks**.
So, like with Lego Bricks, you can compose your device from other building blocks that can
be shared by different devices.

Actually, to explain the full functionality behind that would go to far here ...

The **Information Model** for the RAK8212 looks as follows:

    vortolang 1.0
    namespace org.klenk.connectivity.iot
    version 1.0.0
    displayname "RAK8212"
    description "Information Model for RAK8212"
    
    using com.bosch.iot.suite.example.octopussuiteedition.Humidity; 1.1.0
    using org.eclipse.vorto.tutorial.Temperature; 1.0.0
    using org.eclipse.vorto.Illuminance; 1.0.0
    using com.bosch.iot.suite.example.octopussuiteedition.Magnetometer; 1.1.0
    using org.eclipse.vorto.BarometricPressure; 1.0.0
    using com.bosch.iot.suite.example.octopussuiteedition.Accelerometer; 1.1.0
    using org.eclipse.vorto.Location; 1.0.0
    	
    infomodel RAK8212 {
    
    	functionblocks {
    		temperature as Temperature
    		barometricPressure as BarometricPressure
    		humidity as Humidity
    		magnetometer as Magnetometer
    		accelerometer as Accelerometer
    		illuminance as Illuminance
    		location as Location
    	}
    } 

One of the several advantages to model a device in an **Information Model** is that you now can
generate code or other helpful things from it, like for instance the device provisioning script.

Again, this is out of scope for now, but the provisioning script generated from this **Information Model**
is available in this repository 
([rak8212-device-provisioning-msg.json](rak8212-device-provisioning-msg.json))

Have a look at this Youtube channel of Tim Grossmann for more inspiration about Eclipse Vorto.
https://www.youtube.com/channel/UC9_Bk9247GgJ3k9O7yxctFg/featured

## Device Provisioning

Again, the Bosch tutorial at 
https://www.bosch-iot-suite.com/tutorials/connecting-a-simple-device-to-the-bosch-iot-suite/#book-and-configure
gives detailed instructions how to register your device with the Bosch IoT Suite.

But, as the RAK8212 has its own Information Model and provisioning script, use this one that
is available in this repository:

[rak8212-device-provisioning-msg.json](rak8212-device-provisioning-msg.json)

    {
      "id": "<your namespace>:rak8212",
      "hub": {
        "device": {
          "enabled": true
        },
        "credentials": {
          "type": "hashed-password",
          "secrets": [
            {
              "password": "<your-device-password>"
            }
          ]
        }
      },
      "things": {
        "thing": {
          "attributes": {
            "thingName": "RAK8212",
            "definition": "org.klenk.connectivity.iot:RAK8212:1.0.0"
          },
          "features": {
            "temperature": {
              "definition": [
                "org.eclipse.vorto.tutorial:Temperature:1.0.0"
              ],
              "properties": {
                "status": {
                  "value": 0.0,
                  "unit": ""
                }
              }
            },

## How to send telemetry data

To send telemetry data and in this way update the Digital Twin, you need to built up a 
[Eclise Ditto](https://www.eclipse.org/ditto/protocol-specification.html) message
and publish it to topic `telemetry`.

    sendAtCommandAndWaitForPrompt('AT+QMTPUB=0,1,1,0,'
        + JSON.stringify("telemetry"),
        5000,
        '{' +
        '  "topic": "org.klenk.connectivity.iot/rak8212/things/twin/commands/modify",' +
        '  "headers": {},' +
        '  "path": "/features/temperature/properties",' +
        '  "value": {' +
        '    "status": {' +
        '      "value": ' + currentTemperature + ',' +
        '      "unit": "Degree Celsius"' +
        '    }' +
        '  }' +
        '}',
        '+QMTPUB:'
      )
         .then( ... )

Using the Quectal BG96 module's command `AT+QMTPUB` to publish a message to a MQTT topic,
this code section updates the feature "temperature" of the **Digital Twin**.

## How to subscribe to "modified" events of the Digital Twin

The built-in MQTT client of the Quectel BG96 makes it easy to subscribe to topics:
You just need to use the `AT+QMTSUB` command to subscribe to topic `command/+/+/req/#`.

    sendAtCommand('AT+QMTSUB=0,1,' + JSON.stringify("command/+/+/req/#") + ',1', 15000, '+QMTSUB:')
      .then( ... )

Now, whenever a message is received on this topic, the MQTT client creates an output line 
starting with `+QMTRECV: `, like the following one:

    ] "\r\n+QMTRECV: 0,3,\"command///req/2240e49bdde-57ad-4652-b557-70f2dcf7"
    ] "41c0replies/modified\",\"{\"topic\":\"org.klenk.connectivity.iot"
    ] "/rak8212/things/twin/events/modified\",\"headers\":{\"sec-fetch-mode\":\"cors\", 
    ....

You can see this output if you put the debug mode on.
In case someone changed the device's digital twin, we will receive a [Eclise Ditto](https://www.eclipse.org/ditto/protocol-specification.html) 
"modified" message like the following one:

    {
      "topic": "org.klenk.connectivity.iot/rak8212/things/twin/events/modified",
      "headers": {
        "sec-fetch-mode": "cors",
        "referer": "https://apidocs.bosch-iot-suite.com/?urls.primaryName=Bosch%20IoT%20Things%20-%20API%20v2",
        "sec-fetch-site": "same-site",
        "accept-language": "de-DE, de;q=0.9, en-US;q=0.8, en;q=0.7",
        "correlation-id": "0e49bdde-57ad-4652-b557-70f2dcf741c0",
        "dnt": "1",
        "source": "iot-suite:service:iot-things-eu-1:50058525-a6ed-4401-9984-f678cd509323_things/full-access",
        "version": 2,
        "accept": "application/json",
        "host": "things.eu-1.bosch-iot-suite.com",
        "content-type": "application/vnd.eclipse.ditto+json",
        "accept-encoding": "gzip, deflate, br"
      },
      "path": "/features/temperature/properties",
      "value": {
        "status": {
          "value": 21.61,
          "unit": "Degree Celsius"
        }
      },
      "revision": 525,
      "timestamp": "2019-09-22T10:58:49.666Z"
    }

This one says that the feature "temperature" was modified.

In order to process this message, you just have to write a "handler" that deals with this
incoming message.

## Conclusion
As the [Quectel BG96 module](https://www.quectel.com/product/bg96.htm) already has built in a MQTT
stack, it is simple to communicate with the [Bosch IoT Suite](https://www.bosch-iot-suite.com/) using
this protocol. Using [Espruino](https://www.espruino.com/), one can efficiently build IoT prototypes
without a big learning curve in regards to the programming of embedded devices.

However, it needs to be evaluated if MQTT in combination with this kind of verbose 
[Eclise Ditto](https://www.eclipse.org/ditto/protocol-specification.html) messages is actually a
viable way for NB-IoT communication, where every transmitted byte counts to save energy and 
communication costs.