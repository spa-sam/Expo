import React, { useState } from "react";
import { Text, View, Button, FlatList, Alert } from "react-native";
import { BleManager } from "react-native-ble-plx";
import { request, PERMISSIONS, RESULTS } from "react-native-permissions";

const manager = new BleManager();

export default function Index() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState([]);

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
          if (!prevDevices.find((d) => d.id === device.id)) {
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

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Hello BLE!!!</Text>
      <Button
        title={isScanning ? "Сканування..." : "Почати сканування"}
        onPress={startScan}
      />
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Text>{item.name || "Невідомий пристрій"}</Text>
        )}
      />
    </View>
  );
}
