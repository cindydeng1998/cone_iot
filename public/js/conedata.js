/* eslint-disable max-classes-per-file */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
$(document).ready(() => {
    // if deployed to a site supporting SSL, use wss://
    const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
    const webSocket = new WebSocket(protocol + location.host);
  
    // A class for holding the last N points of telemetry for a device
    class DeviceData {
      constructor(deviceId) {
        this.deviceId = deviceId;
        this.maxLen = 10;
        this.coneLoc = new Array(this.maxLen);
        for (let i = 0; i < this.maxLen; i++) {
            this.coneLoc[i] = { x: 0, y: 0};
        }
        this.numCones = 0;
      }

      setNumCones(numCones)
      {
          this.numCones = numCones;
      }
  

      // just wanna have sets of x and y
      drawCones(){
          // might be place where we add the x and y coords to the canvas to draw the cones
          for (let i = 0; i < this.numCones; i++)
          {
              cones[i].x = ((this.coneLoc[i].x));
              cones[i].y = (this.coneLoc[i].y);
          }
      }

      trilaterate_calc(dist1, dist2, dist3, coneNum)
      {
        // units can be in cm
        var p1 = { x: 25, y:  350, z:  0, r: dist1};
        var p2 = { x: 400, y: 375, z:  0, r: dist2};
        var p3 = { x: 650, y: 25, z: 0, r: dist3};
        var p4 = this.trilaterate(p1, p2, p3);
        
        if (p4 !== null)
        {
            if (p4 instanceof Array)
            {
                this.coneLoc[coneNum].x = (p4[0].x + p4[1].x)/2;
                this.coneLoc[coneNum].y = (p4[0].y + p4[1].y)/2;
                
            }
            else
            {
                this.coneLoc[coneNum].x = p4.x;
                this.coneLoc[coneNum].y = p4.y;
            }
        }
        else
        {
            console.log("error calculating trilaterate");
        }
        this.drawCones();
    }
        
     trilaterate(p1, p2, p3, return_middle)
      {
        // based on: https://en.wikipedia.org/wiki/Trilateration
        
        // some additional local functions declared here for
        // scalar and vector operations
        
        function sqr(a)
        {
            return a * a;
        }
        
        function norm(a)
        {
            return Math.sqrt(sqr(a.x) + sqr(a.y) + sqr(a.z));
        }
        
        function dot(a, b)
        {
            return a.x * b.x + a.y * b.y + a.z * b.z;
        }
        
        function vector_subtract(a, b)
        {
            return {
                x: a.x - b.x,
                y: a.y - b.y,
                z: a.z - b.z
            };
        }
        
        function vector_add(a, b)
        {
            return {
                x: a.x + b.x,
                y: a.y + b.y,
                z: a.z + b.z
            };
        }
        
        function vector_divide(a, b)
        {
            return {
                x: a.x / b,
                y: a.y / b,
                z: a.z / b
            };
        }
        
        function vector_multiply(a, b)
        {
            return {
                x: a.x * b,
                y: a.y * b,
                z: a.z * b
            };
        }
        
        function vector_cross(a, b)
        {
            return {
                x: a.y * b.z - a.z * b.y,
                y: a.z * b.x - a.x * b.z,
                z: a.x * b.y - a.y * b.x
            };
        }
        
        var ex, ey, ez, i, j, d, a, x, y, z, b, p4;
        
        ex = vector_divide(vector_subtract(p2, p1), norm(vector_subtract(p2, p1)));
        
        i = dot(ex, vector_subtract(p3, p1));
        a = vector_subtract(vector_subtract(p3, p1), vector_multiply(ex, i));
        ey = vector_divide(a, norm(a));
        ez =  vector_cross(ex, ey);
        d = norm(vector_subtract(p2, p1));
        j = dot(ey, vector_subtract(p3, p1));
        
        x = (sqr(p1.r) - sqr(p2.r) + sqr(d)) / (2 * d);
        y = (sqr(p1.r) - sqr(p3.r) + sqr(i) + sqr(j)) / (2 * j) - (i / j) * x;
        
        b = sqr(p1.r) - sqr(x) - sqr(y);
        
        // floating point math flaw in IEEE 754 standard
        // see https://github.com/gheja/trilateration.js/issues/2
        if (Math.abs(b) < 0.01)
        {
            b = 0;
        }
        
        z = Math.sqrt(b);
        
        // no solution found
        if (isNaN(z))
        {
            return null;
        }
        
        a = vector_add(p1, vector_add(vector_multiply(ex, x), vector_multiply(ey, y)));
        var p4a = vector_add(a, vector_multiply(ez, z));
        var p4b = vector_subtract(a, vector_multiply(ez, z));
        
        if (z == 0 || return_middle)
        {
            return a;
        }
        else
        {
            return [p4a, p4b];
        }
      }
      

    }
  
    // All the devices in the list (those that have been sending telemetry)
    class TrackedDevices {
      constructor() {
        // array of class DeviceData
        this.devices = [];
      }
  
      // Find a device based on its Id
      findDevice(deviceId) {
        for (let i = 0; i < this.devices.length; ++i) {
          if (this.devices[i].deviceId === deviceId) {
            return this.devices[i];
          }
        }
  
        return undefined;
      }
  
      getDevicesCount() {
        return this.devices.length;
      }
    }
  
    const trackedDevices = new TrackedDevices();
  
    // Get the context of the canvas element we want to select
    const ctx = document.getElementById('iotChart').getContext('2d');
  
    // Manage a list of devices in the UI, and update which device data the chart is showing
    // based on selection
    let needsAutoSelect = true;
    const deviceCount = document.getElementById('deviceCount');
    const listOfDevices = document.getElementById('listOfDevices');

    function OnSelectionChange() {
      console.log("no other devices for now");
    }

    
  
    // When a web socket message arrives:
    // 1. Unpack it
    // 2. Validate it has date/time and temperature
    // 3. Find or create a cached device to hold the telemetry data
    // 4. Append the telemetry data
    // 5. Update the chart UI
    webSocket.onmessage = function onMessage(message) {
      try {
        const messageData_ = JSON.parse(message.data);
        var messageData = messageData_["IotData"];
        console.log(messageData);

        // parse event data
        // var raw_data = JSON.parse(JSON.stringify(events[i].body));
        var numCones = messageData["numCones"];
        // console.log("numCones: " + numCones);
    
        // find or add device to list of tracked devices
        const existingDeviceData = trackedDevices.findDevice(messageData.DeviceId);
  
        if (existingDeviceData) {
            existingDeviceData.setNumCones(numCones);
            for (let j = 1; j < numCones+1; j++)
            {
                var coneName = "cone" + j;
                var dist1 = messageData["cone_ds"][coneName]["d1"];
                var dist2 = messageData["cone_ds"][coneName]["d2"];
                var dist3 = messageData["cone_ds"][coneName]["d3"];
                existingDeviceData.trilaterate_calc(dist1, dist2, dist3, j-1);
            }
        } else {
          const newDeviceData = new DeviceData(messageData.DeviceId);
          trackedDevices.devices.push(newDeviceData);
          const numDevices = trackedDevices.getDevicesCount();
          deviceCount.innerText = numDevices === 1 ? `${numDevices} device` : `${numDevices} devices`;

          newDeviceData.setNumCones(numCones);
          for (let j = 1; j < numCones+1; j++)
          {
            var coneName = "cone" + j;
            var dist1 = messageData["cone_ds"][coneName]["d1"];
            var dist2 = messageData["cone_ds"][coneName]["d2"];
            var dist3 = messageData["cone_ds"][coneName]["d3"];
            newDeviceData.trilaterate(dist1, dist2, dist3, j-1);
          }

          // add device to the UI list
          const node = document.createElement('option');
          const nodeText = document.createTextNode(messageData_.DeviceId);
          node.appendChild(nodeText);
          listOfDevices.appendChild(node);
  
          // if this is the first device being discovered, auto-select it
          if (needsAutoSelect) {
            needsAutoSelect = false;
            listOfDevices.selectedIndex = 0;
            OnSelectionChange();
          }
        }
  
      } catch (err) {
        console.error(err);
      }
    };
  });
  