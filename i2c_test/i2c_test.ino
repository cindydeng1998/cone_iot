#include<Wire.h>    

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200); 
  Wire.begin();       
}

void loop() {
  // put your main code here, to run repeatedly:
  // one byte at a time for now
  Wire.requestFrom(0, 8);   
  while(Wire.available())    // slave may send less than requested
  {
    char c = Wire.read();    // receive a byte as character
    Serial.print(c);         // print the character
  }
  Serial.print("1");
  delay(500);


  // for later use
  /*
   * Wire.beginTransmission(8);                             
      Wire.write(x);                        
      Wire.endTransmission();   
  */
}
