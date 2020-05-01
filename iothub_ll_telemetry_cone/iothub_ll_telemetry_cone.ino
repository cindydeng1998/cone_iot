// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#include <AzureIoTHub.h>


// CAVEAT: This sample is to demonstrate azure IoT client concepts only and is not a guide design principles or style
// Checking of return codes and error values shall be omitted for brevity.  Please practice sound engineering practices
// when writing production code.

// Note: PLEASE see https://github.com/Azure/azure-iot-arduino#simple-sample-instructions for detailed sample setup instructions.
// Note2: To use this sample with the esp32, you MUST build the AzureIoTSocket_WiFi library by using the make_sdk.py,
//        found in https://github.com/Azure/azure-iot-pal-arduino/tree/master/build_all. 
//        Command line example: python3 make_sdk.py -o <your-lib-folder>

#include <stdio.h>
#include <stdlib.h>

// You must set the device id, device key, IoT Hub name and IotHub suffix in
// iot_configs.h
#include "iot_configs.h"
#include "sample_init.h"
#ifdef is_esp_board
  #include "Esp.h"
#endif


static char ssid[] = IOT_CONFIG_WIFI_SSID;
static char pass[] = IOT_CONFIG_WIFI_PASSWORD;

#ifdef SAMPLE_MQTT
    #include "AzureIoTProtocol_MQTT.h"
    #include "iothubtransportmqtt.h"
#endif // SAMPLE_MQTT
#ifdef SAMPLE_HTTP
    #include "AzureIoTProtocol_HTTP.h"
    #include "iothubtransporthttp.h"
#endif // SAMPLE_HTTP

/* Define several constants/global variables */
static const char* connectionString = DEVICE_CONNECTION_STRING;
#define MESSAGE_COUNT 5 // determines the number of times the device tries to send a message to the IoT Hub in the cloud.
static bool g_continueRunning = true; // defines whether or not the device maintains its IoT Hub connection after sending (think receiving messages from the cloud)
static size_t g_message_count_send_confirmations = 0;

IOTHUB_MESSAGE_HANDLE message_handle;
size_t messages_sent = 0;
char telemetry_msg[750] = "";
//String telemetry_str = "{\"numCones\": 5,   \"deviceToCloud\": true,   \"cone_dists\": {     \"cone1\":      {       \"dist1\": 279.5084972,       \"dist2\": 442.2951503,       \"dist3\": 577.169819     },     \"cone2\": {       \"dist1\": 325.9601203,       \"dist2\": 360.5551275,       \"dist3\": 452.7692569     },     \"cone3\": {       \"dist1\": 279.5084972,       \"dist2\": 195.2562419,       \"dist3\": 425     },     \"cone4\": {       \"dist1\": 353.5533906,       \"dist2\": 79.0569415,       \"dist3\": 388.9087297     },     \"cone5\": {       \"dist1\": 450,       \"dist2\": 79.0569415,       \"dist3\": 369.1205765     },     \"cone6\": {       \"dist1\": 4233.680196,       \"dist2\": 1614.455946,       \"dist3\": 3595.871661     }        } }";
//String telemetry_str = "{\"numCones\": 5,   \"deviceToCloud\": true,   \"cone_dists\": {     \"cone1\":      {       \"dist1\": 279.5084972,       \"dist2\": 442.2951503,       \"dist3\": 577.169819     },     \"cone2\": {       \"dist1\": 325.9601203,       \"dist2\": 360.5551275,       \"dist3\": 452.7692569     },     \"cone3\": {       \"dist1\": 254.95,       \"dist2\": 145.77,       \"dist3\": 465     },     \"cone4\": {       \"dist1\": 416.1,       \"dist2\": 251.25,       \"dist3\": 292.6     },     \"cone5\": {       \"dist1\": 450,       \"dist2\": 79.0569415,       \"dist3\": 369.1205765     },     \"cone6\": {       \"dist1\": 4233.680196,       \"dist2\": 1614.455946,       \"dist3\": 3595.871661     }        } }";
String telemetry_str = "{\"numCones\":5,\"deviceToCloud\":true,\"cone_ds\":{\"cone1\":{\"lightOn\":false,\"d1\":5623.095233,\"d2\":3444.19802,\"d3\":4451.550404},\"cone2\":{\"lightOn\":false,\"d1\":4387.923541,\"d2\":1813.916481,\"d3\":3861.944847},\"cone3\":{\"lightOn\":false,\"d1\":1378.12191,\"d2\":1245.423623,\"d3\":1220.33479},\"cone4\":{\"lightOn\":false,\"d1\":4485.423614,\"d2\":2167.169813,\"d3\":4223.62593},\"cone5\":{\"lightOn\":false,\"d1\":569.9938596,\"d2\":3191.440584,\"d3\":1737.465971}}}";

// Select the Protocol to use with the connection
#ifdef SAMPLE_MQTT
    IOTHUB_CLIENT_TRANSPORT_PROVIDER protocol = MQTT_Protocol;
#endif // SAMPLE_MQTT
#ifdef SAMPLE_HTTP
   IOTHUB_CLIENT_TRANSPORT_PROVIDER protocol = HTTP_Protocol;
#endif // SAMPLE_HTTP

IOTHUB_DEVICE_CLIENT_LL_HANDLE device_ll_handle;

static int callbackCounter;
int receiveContext = 0;

/* -- receive_message_callback --
 * Callback method which executes upon receipt of a message originating from the IoT Hub in the cloud. 
 * Note: Modifying the contents of this method allows one to command the device from the cloud. 
 */
static IOTHUBMESSAGE_DISPOSITION_RESULT receive_message_callback(IOTHUB_MESSAGE_HANDLE message, void* userContextCallback)
{
  int* counter = (int*)userContextCallback;
    const char* buffer;
    size_t size;
    MAP_HANDLE mapProperties;
    const char* messageId;

    // Message properties
    if ((messageId = IoTHubMessage_GetMessageId(message)) == NULL)
    {
        messageId = "<null>";
    }

    // Message content
    if (IoTHubMessage_GetByteArray(message, (const unsigned char**)&buffer, &size) != IOTHUB_MESSAGE_OK)
    {
        LogInfo("unable to retrieve the message data\r\n");
    }
    else
    {
        LogInfo("Received Message [%d]\r\n Message ID: %s\r\n Data: <<<%.*s>>> & Size=%d\r\n", *counter, messageId, (int)size, buffer, (int)size);
        Serial.print(buffer);
        // If we receive the work 'quit' then we stop running
//        
//        if (size == (strlen("quit") * sizeof(char)) && memcmp(buffer, "quit", size) == 0)
//        {
//            g_continueRunning = false;
//        }
//          char* printbuffer[1000];
//          memcpy(printbuffer, buffer, (int)size);
//          LogInfo(printbuffer);
    }

    /* Some device specific action code goes here... */
    (*counter)++;
    return IOTHUBMESSAGE_ACCEPTED;
}


/* -- send_confirm_callback --
 * Callback method which executes upon confirmation that a message originating from this device has been received by the IoT Hub in the cloud.
 */
static void send_confirm_callback(IOTHUB_CLIENT_CONFIRMATION_RESULT result, void* userContextCallback)
{
    (void)userContextCallback;
    // When a message is sent this callback will get envoked
    g_message_count_send_confirmations++;
    LogInfo("Callback");
    // LogInfo("Confirmation callback received for message %lu with result %s\r\n", (unsigned long)g_message_count_send_confirmations, MU_ENUM_TO_STRING(IOTHUB_CLIENT_CONFIRMATION_RESULT, result));
}

/* -- connection_status_callback --
 * Callback method which executes on receipt of a connection status message from the IoT Hub in the cloud.
 */
static void connection_status_callback(IOTHUB_CLIENT_CONNECTION_STATUS result, IOTHUB_CLIENT_CONNECTION_STATUS_REASON reason, void* user_context)
{
    (void)reason;
    (void)user_context;
    // This sample DOES NOT take into consideration network outages.
    if (result == IOTHUB_CLIENT_CONNECTION_AUTHENTICATED)
    {
        LogInfo("client connected to iothub\r\n");
    }
}

void setup() {
    int result = 0;
    telemetry_str.toCharArray(telemetry_msg,telemetry_str.length()+1);
    sample_init(ssid, pass);
//    Wire.begin();       


    // Create the iothub handle here
    device_ll_handle = IoTHubDeviceClient_LL_CreateFromConnectionString(connectionString, protocol);
    // Used to initialize IoTHub SDK subsystem
    (void)IoTHub_Init();
    
    LogInfo("Creating IoTHub Device handle\r\n");
    if (device_ll_handle == NULL)
    {
        LogInfo("Error AZ002: Failure createing Iothub device.\r\n");
    }
    else
    {
        // Set any option that are neccessary.
        // For available options please see the iothub_sdk_options.md documentation
        // turn off diagnostic sampling
        int diag_off=0;
        IoTHubDeviceClient_LL_SetOption(device_ll_handle, OPTION_DIAGNOSTIC_SAMPLING_PERCENTAGE, &diag_off);

#ifndef SAMPLE_HTTP
        // Example sdk status tracing for troubleshooting
        bool traceOn = true;
        IoTHubDeviceClient_LL_SetOption(device_ll_handle, OPTION_LOG_TRACE, &traceOn);
#endif // SAMPLE_HTTP

        // Setting the Trusted Certificate.
        IoTHubDeviceClient_LL_SetOption(device_ll_handle, OPTION_TRUSTED_CERT, certificates);

#if defined SAMPLE_MQTT || defined SAMPLE_MQTT_WS
        //Setting the auto URL Encoder (recommended for MQTT). Please use this option unless
        //you are URL Encoding inputs yourself.
        //ONLY valid for use with MQTT
        bool urlEncodeOn = true;
        IoTHubDeviceClient_LL_SetOption(device_ll_handle, OPTION_AUTO_URL_ENCODE_DECODE, &urlEncodeOn);
        /* Setting Message call back, so we can receive Commands. */
        if (IoTHubClient_LL_SetMessageCallback(device_ll_handle, receive_message_callback, &receiveContext) != IOTHUB_CLIENT_OK)
        {
            LogInfo("ERROR: IoTHubClient_LL_SetMessageCallback..........FAILED!\r\n");
        }
#endif // SAMPLE_MQTT

        // Setting connection status callback to get indication of connection to iothub
        (void)IoTHubDeviceClient_LL_SetConnectionStatusCallback(device_ll_handle, connection_status_callback, NULL);

        // action phase of the program, sending messages to the IoT Hub in the cloud.
        do
        {
//          Wire.requestFrom(0, 8);   
//          int i = 0;
//          while(Wire.available())    // slave may send less than requested
//          {
//            char c = Wire.read();    // receive a byte as character
//            //telemetry_msg[i] = c;
//            if(i == 7)
//            {
//              i = 0;
//            }
//            else{
//              i++;
//            }
//          }
//          Serial.println(telemetry_msg);
            if (messages_sent < MESSAGE_COUNT)
            {
                // Construct the iothub message from a string or a byte array
                message_handle = IoTHubMessage_CreateFromString(telemetry_msg);
                //message_handle = IoTHubMessage_CreateFromByteArray((const unsigned char*)msgText, strlen(msgText)));

                // Set Message property
                /*(void)IoTHubMessage_SetMessageId(message_handle, "MSG_ID");
                (void)IoTHubMessage_SetCorrelationId(message_handle, "CORE_ID");
                (void)IoTHubMessage_SetContentTypeSystemProperty(message_handle, "application%2fjson");
                (void)IoTHubMessage_SetContentEncodingSystemProperty(message_handle, "utf-8");*/

                // Add custom properties to message
                // (void)IoTHubMessage_SetProperty(message_handle, "property_key", "property_value");

                LogInfo("Sending message %d to IoTHub\r\n", (int)(messages_sent + 1));
                result = IoTHubDeviceClient_LL_SendEventAsync(device_ll_handle, message_handle, send_confirm_callback, NULL);
                // The message is copied to the sdk so the we can destroy it
                IoTHubMessage_Destroy(message_handle);

                // lets send infinite message for now
                messages_sent++;
            }
            else if (g_message_count_send_confirmations >= MESSAGE_COUNT)
            {
                // After all messages are all received stop running
//                g_continueRunning = false;
            }

            IoTHubDeviceClient_LL_DoWork(device_ll_handle);
            ThreadAPI_Sleep(3000); // three seconds
          
#ifdef is_esp_board
            // Read from local serial 
            if (Serial.available()){
                String s1 = Serial.readStringUntil('\n');// s1 is String type variable.
                Serial.print("Received Data: ");
                Serial.println(s1);//display same received Data back in serial monitor.

            }
#endif // is_esp_board
        } while (g_continueRunning);

        // Clean up the iothub sdk handle
        IoTHubDeviceClient_LL_Destroy(device_ll_handle);
    }
    // Free all the sdk subsystem
    IoTHub_Deinit();

    LogInfo("done with sending");
    return;
}

void loop(void)
{
  
#ifdef is_esp_board
    if (Serial.available()){
        String s1 = Serial.readStringUntil('\n');// s1 is String type variable.
        Serial.print("RxData: ");
        Serial.println(s1);//display same received Data back in serial monitor.
        
        int e_start = s1.indexOf('e');
        String ebit = (String) s1.substring(e_start, e_start+4);
        if(ebit == "exit")
        {
            ESP.restart();
        }
    }
#endif // is_esp_board

 
}



// magic: az iot hub monitor-events --hub-name ConeProject --output table
