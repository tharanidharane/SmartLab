import { View, ActivityIndicator } from 'react-native';

export default function Index() {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
            <ActivityIndicator size="large" color="#3b82f6" />
        </View>
    );
}
