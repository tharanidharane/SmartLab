import { useEffect } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from '../lib/api';

// In Expo Go the executionEnvironment is 'storeClient' (SDK <50) or
// the appOwnership is 'expo'. Either condition means we skip push setup.
const isExpoGo =
    Constants.appOwnership === 'expo' ||
    (Constants.executionEnvironment as string) === 'storeClient';

export const usePushNotifications = () => {
    useEffect(() => {
        if (isExpoGo) return; // Push tokens not available in Expo Go

        const register = async () => {
            try {
                const Notifications = await import('expo-notifications');
                const Device = await import('expo-device');

                Notifications.setNotificationHandler({
                    handleNotification: async () => ({
                        shouldShowAlert: true,
                        shouldPlaySound: true,
                        shouldSetBadge: true,
                        shouldShowBanner: true,
                        shouldShowList: true,
                    }),
                });

                if (!Device.isDevice) return;

                const { status: existing } = await Notifications.getPermissionsAsync();
                let finalStatus = existing;
                if (existing !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                }
                if (finalStatus !== 'granted') return;

                if (Platform.OS === 'android') {
                    await Notifications.setNotificationChannelAsync('bookings', {
                        name: 'Booking Updates',
                        importance: Notifications.AndroidImportance.HIGH,
                        vibrationPattern: [0, 250, 250, 250],
                    });
                }

                const token = (await Notifications.getExpoPushTokenAsync()).data;
                api.post('/users/push-token', { expoPushToken: token })
                    .catch(() => { });
            } catch { }
        };

        register();
    }, []);
};
