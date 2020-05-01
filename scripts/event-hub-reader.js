/*
 * Microsoft Sample Code - Copyright (c) 2020 - Licensed MIT
 */

const { EventHubProducerClient, EventHubConsumerClient } = require('@azure/event-hubs');
const { convertIotHubToEventHubsConnectionString } = require('./iot-hub-connection-string.js');

class EventHubReader {
  constructor(iotHubConnectionString, consumerGroup) {
    this.iotHubConnectionString = iotHubConnectionString;
    this.consumerGroup = consumerGroup;
  }

  async startReadMessage(startReadMessageCallback) {
    try {
      const eventHubConnectionString = await convertIotHubToEventHubsConnectionString(this.iotHubConnectionString);
      const consumerClient = new EventHubConsumerClient(this.consumerGroup, eventHubConnectionString);
      console.log('Successfully created the EventHubConsumerClient from IoT Hub event hub-compatible connection string.');

      const partitionIds = await consumerClient.getPartitionIds();
      console.log('The partition ids are: ', partitionIds);

      consumerClient.subscribe({
        processEvents: (events, context) => {
          for (let i = 0; i < events.length; ++i) {
            startReadMessageCallback(
              events[i].body,
              events[i].enqueuedTimeUtc,
              events[i].systemProperties["iothub-connection-device-id"]);
              
              // parse event data
			  var raw_data = JSON.parse(JSON.stringify(events[i].body));
			  var numCones = raw_data["numCones"];
			  console.log("numCones: " + numCones);
			  for (let j = 1; j < numCones+1; j++)
			  {
				var coneName = "cone" + j;

				var dist1 = raw_data["cone_dists"][coneName]["dist1"];
				var dist2 = raw_data["cone_dists"][coneName]["dist2"];
				var dist3 = raw_data["cone_dists"][coneName]["dist3"];
				// console.log(dist1)
				// console.log(dist2)
				// console.log(dist3)
				console.log(coneName + " is located at");
				trilaterate_calc(dist1, dist2, dist3);	  
			  }
              
          }
        },
        processError: (err, context) => {
		  // error here doenst mean transmission error, it means there is error elsewhere in the handler above
		  console.error("am i in error??");
          console.error(err.message || err);
        }
      });
    } catch (ex) {
      console.error(ex.message || ex);
    }
  }

  // Close connection to Event Hub.
  async stopReadMessage() {
    const disposeHandlers = [];
    this.receiveHandlers.forEach((receiveHandler) => {
      disposeHandlers.push(receiveHandler.stop());
    });
    await Promise.all(disposeHandlers);

    this.consumerClient.close();
  }
}

function trilaterate_calc(dist1, dist2, dist3)
{
    // units can be in cm
    p1 = { x: 1240, y:   5960, z:  0, r: dist1};
    p2 = { x: 2000, y: 3450, z:  0, r: dist2};
    p3 = { x: 470, y: 4851, z: 0, r: dist3};
    p4 = trilaterate(p1, p2, p3);
    
    if (p4 !== null)
    {
        if (p4 instanceof Array)
        {
			if(p4[0].x == p4[1].x)
			{
				console.log("x: " + p4[0].x);
				console.log("y: " + p4[0].y);
			}
			else
			{
				console.log("x: " + p4[1].x);
				console.log("y: " + p4[1].y);
			}
        }
        else
        {
            console.log(p4.x);
            console.log(p4.y);
        }
    }
    else
    {
        console.log("error calculating trilaterate");
    }
}
     
function trilaterate(p1, p2, p3, return_middle)
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
	
	a = vector_add(p1, vector_add(vector_multiply(ex, x), vector_multiply(ey, y)))
	p4a = vector_add(a, vector_multiply(ez, z));
	p4b = vector_subtract(a, vector_multiply(ez, z));
	
	if (z == 0 || return_middle)
	{
		return a;
	}
	else
	{
		return [ p4a, p4b ];
	}
}

module.exports = EventHubReader;
