import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppLockScreen from './src/screens/AppLockScreen';
import { RootStackParamList } from './src/navigation/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.homeContainer}>
        <Text style={styles.title}>App Lock Demo</Text>
        <Text style={styles.subtitle}>
          Manage app locking and view installed apps.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('AppLock')}>
          <Text style={styles.primaryButtonText}>Open App Lock Screen</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AppLock" component={AppLockScreen}  options={{ headerShown: false }}/>
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  homeContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    gap: 16,
  },
  screenContainer: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 15,
    color: '#475569',
    marginBottom: 6,
  },
  statusLabel: {
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default App;
