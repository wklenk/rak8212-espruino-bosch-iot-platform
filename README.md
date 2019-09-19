# rak8212-espruino-bosch-iot-platform
Example how to connect to the Bosch IoT Platform using the Quectel BG96's built-in MQTT stack.

The example will be a simple data logger, periodically sending sensor
values using NB-IoT connectivity.

The RAK8212 has quite a few sensors on board:

* Temperature
* Humidity
* Barometeric Pressure
* Ambient Light
* Accelerometer
* Magnetometer
* Location (GNSS)

## Step 1: Subscribe to Bosch IoT Suite
Create yourself a **Bosch IoT Suite account** at http://bosch-iot-suite.com 
and then subscribe to a free plan of the 
**Bosch IoT Suite for Asset Communication** service package. 
This is a ready-to-use integration of **Bosch IoT Hub** and **Bosch IoT Things** for 
large-scale ingestion of sensor telemetry data and for remote asset control.

Give a name to this service package instance, like `klenk-asset-communication`. 

![Service Subscription](media/service-subscription.png)

A tutorial how to get started with the Bosch IoT Suite can be found here:
https://www.bosch-iot-suite.com/getting-started

## Step 2: Create OAuth2 Client

The Bosch IoT Suite is composed of several services, and all of these services need you to 
authenticate to interact with them. Fortunately, you can make use of OAuth2 security tokens to
authenticate, and the Bosch IoT Suite has a built-in OAuth2 Client that can be used to generate
these OAuth2 tokens. 

Click the Account Icon, and from the pull-down menu select "OAuth2 Clients".

![OAuth2 Clients](media/oauth2-clients.png)

Create a new OAuth2 Client, assign a name to it and for "scope" select both the "Hub" and "Things".

![OAuth2 Client Scope](media/oauth2-client-scope.png)

When created, it takes some time for the Suite to create the new OAuth2 Client, but when finished
it provides a  `Client ID` and a `Client secret` for you that can be used to create OAuth2 tokens from
now on, either interactively in this web portal, or programmatically by other applications that
need to authenticate against Bosch IoT Suite services ("Suite Authentication").

![OAuth2 Client Details](media/oauth2-client-details.png)

## Step 3: About Vorto Information Models

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

## Step 4: Device Provisioning



To be continued ...