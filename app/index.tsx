import React, { useState, useEffect } from "react";
import { Text, View, Button, FlatList, Alert, StyleSheet } from "react-native";
import { BleManager, Device } from "react-native-ble-plx";
import { request, PERMISSIONS, RESULTS } from "react-native-permissions";
import { decode as base64decode, encode as base64encode } from "base-64";

const manager = new BleManager();
const ESP32_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const ESP32_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const ESP32_LED_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a9";

export default function Index() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [analogValue, setAnalogValue] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [led12State, setLed12State] = useState(false);
  const [led13State, setLed13State] = useState(false);

  useEffect(() => {
    return () => {
      manager.destroy();
    };
  }, []);

  const requestLocationPermission = async () => {
    const result = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    if (result !== RESULTS.GRANTED) {
      Alert.alert(
        "Потрібен дозвіл",
        "Для сканування Bluetooth пристроїв потрібен дозвіл на геолокацію",
        [{ text: "OK" }]
      );
      return false;
    }
    return true;
  };

  const startScan = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    const state = await manager.state();
    if (state !== "PoweredOn") {
      Alert.alert(
        "Bluetooth вимкнено",
        "Будь ласка, увімкніть Bluetooth у налаштуваннях вашого пристрою.",
        [{ text: "OK" }]
      );
      return;
    }

    if (!isScanning) {
      setIsScanning(true);
      setDevices([]);
      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.log(error);
          setIsScanning(false);
          return;
        }
        setDevices((prevDevices) => {
          if (device && !prevDevices.find((d) => d.id === device.id)) {
            return [...prevDevices, device];
          }
          return prevDevices;
        });
      });
      setTimeout(() => {
        manager.stopDeviceScan();
        setIsScanning(false);
      }, 5000);
    }
  };

  const connectToDevice = async (device: Device) => {
    try {
      const connectedDevice = await device.connect();
      setConnectedDevice(connectedDevice);
      setIsConnected(true);
      await connectedDevice.discoverAllServicesAndCharacteristics();
      startStreamingData(connectedDevice);
    } catch (error) {
      console.log("Помилка підключення:", error);
    }
  };

  const startStreamingData = (device: Device) => {
    device.monitorCharacteristicForService(
      ESP32_SERVICE_UUID,
      ESP32_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.log("Помилка моніторингу:", error);
          return;
        }
        if (characteristic?.value) {
          const bytes = base64decode(characteristic.value);
          const rawValue = (bytes.charCodeAt(0) << 8) | bytes.charCodeAt(1);
          setAnalogValue(rawValue);
        }
      }
    );
  };

  const toggleLed = async (ledNumber: 12 | 13) => {
    if (!connectedDevice) return;

    const newState = ledNumber === 12 ? !led12State : !led13State;
    const ledStates = new Uint8Array([
      ledNumber === 12 ? Number(newState) : Number(led12State),
      ledNumber === 13 ? Number(newState) : Number(led13State),
    ]);

    try {
      await connectedDevice.writeCharacteristicWithoutResponseForService(
        ESP32_SERVICE_UUID,
        ESP32_LED_CHARACTERISTIC_UUID,
        base64encode(String.fromCharCode.apply(null, ledStates))
      );

      if (ledNumber === 12) {
        setLed12State(newState);
      } else {
        setLed13State(newState);
      }
    } catch (error) {
      console.log("Помилка при зміні стану світлодіода:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Тестова програма BLE для ESP32-C3</Text>

      <View style={styles.scanButtonContainer}>
        <Button
          title={isScanning ? "Сканування..." : "Почати сканування"}
          onPress={startScan}
          disabled={isScanning}
        />
      </View>
      {!isConnected && (
        <View style={styles.deviceListContainer}>
          <Text style={styles.subtitle}>Знайдені пристрої:</Text>
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.deviceItem}>
                <Text style={styles.deviceName}>
                  {item.name || "Невідомий пристрій"}
                </Text>
                <Button
                  title="Підключити"
                  onPress={() => connectToDevice(item)}
                />
              </View>
            )}
          />
        </View>
      )}
      {connectedDevice && (
        <View style={styles.connectedDeviceCard}>
          <Text style={styles.connectedDeviceTitle}>Підключений пристрій:</Text>
          <Text>{connectedDevice.name || connectedDevice.id}</Text>
        </View>
      )}

      {analogValue !== null && (
        <View style={styles.analogValueCard}>
          <Text style={styles.analogValueTitle}>
            Дані з аналогового датчика:
          </Text>
          <Text style={styles.analogValue}>{analogValue}</Text>
        </View>
      )}

      {isConnected && (
        <View style={styles.ledControlContainer}>
          <Button
            title={`LED 12: ${led12State ? "ON" : "OFF"}`}
            onPress={() => toggleLed(12)}
          />
          <Button
            title={`LED 13: ${led13State ? "ON" : "OFF"}`}
            onPress={() => toggleLed(13)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  scanButtonContainer: {
    marginBottom: 20,
  },
  deviceListContainer: {
    flex: 1,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  deviceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  deviceName: {
    fontSize: 16,
  },
  connectedDeviceCard: {
    backgroundColor: "#e6f7ff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  connectedDeviceTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  analogValueCard: {
    backgroundColor: "#f0f5ff",
    padding: 15,
    borderRadius: 10,
  },
  analogValueTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  analogValue: {
    fontSize: 24,
    textAlign: "center",
  },
  ledControlContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
  },
});
