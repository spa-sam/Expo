#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define LED_CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define ANALOG_PIN 1
#define LED_PIN_12 12
#define LED_PIN_13 13

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
BLECharacteristic* pLedCharacteristic = NULL;
bool deviceConnected = false;

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
    }
};

class LedCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value = pCharacteristic->getValue();
      if (value.length() == 2) {
        digitalWrite(LED_PIN_12, value[0] ? HIGH : LOW);
        digitalWrite(LED_PIN_13, value[1] ? HIGH : LOW);
      }
    }
};

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN_12, OUTPUT);
  pinMode(LED_PIN_13, OUTPUT);

  BLEDevice::init("ESP32-C3 Analog");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ   |
                      BLECharacteristic::PROPERTY_NOTIFY
                    );

  pLedCharacteristic = pService->createCharacteristic(
                      LED_CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_WRITE
                    );

  pLedCharacteristic->setCallbacks(new LedCallbacks());

  pCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0);
  BLEDevice::startAdvertising();
  Serial.println("BLE пристрій готовий до підключення!");
}

void loop() {
  if (deviceConnected) {
    uint16_t analogValue = analogRead(ANALOG_PIN);
    pCharacteristic->setValue((uint8_t*)&analogValue, 2);
    pCharacteristic->notify();
    
    // Вивід аналогових даних у серійний порт
    Serial.print("Аналогове значення: ");
    Serial.println(analogValue);
    
    delay(200);
  } else {
    // Якщо пристрій не підключено, перезапускаємо рекламування
    BLEDevice::startAdvertising();
    delay(500);
  }
}