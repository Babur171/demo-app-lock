import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  ListRenderItemInfo,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppLock, useAppLock, type InstalledApp } from 'react-native-app-lock';
import { RootStackParamList } from '../navigation/types';
import { useAppLockStore } from '../store/appLockStore';

type AppLockScreenProps = NativeStackScreenProps<RootStackParamList, 'AppLock'>;

const AppRow: React.FC<{
  item: InstalledApp;
  isLocked: boolean;
  isSaving: boolean;
  onToggle: (pkg: string, lock: boolean) => void;
}> = React.memo(({ item, isLocked, isSaving, onToggle }) => {
  const iconUri = item.icon ? { uri: `data:image/png;base64,${item.icon}` } : null;

  return (
    <View style={styles.appRow}>
      <View style={styles.appLeft}>
        {iconUri ? (
          <Image source={iconUri} style={styles.appIcon} />
        ) : (
          <View style={styles.appIconPlaceholder}>
            <Text style={styles.appIconLetter}>{item.appName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.appInfo}>
          <Text style={styles.appName} numberOfLines={1}>
            {item.appName}
          </Text>
          <Text style={styles.appPkg} numberOfLines={1}>
            {item.packageName}
          </Text>
        </View>
      </View>

      {isSaving ? (
        <ActivityIndicator size="small" color="#FF6844" />
      ) : (
        <Switch
          value={isLocked}
          onValueChange={val => onToggle(item.packageName, val)}
          trackColor={{ false: '#E5E7EB', true: '#FF684440' }}
          thumbColor={isLocked ? '#FF6844' : '#9CA3AF'}
          ios_backgroundColor="#E5E7EB"
        />
      )}
    </View>
  );
});

const EmptyList = () => <Text style={styles.emptyText}>No apps found.</Text>;
const ItemSeparator = () => <View style={styles.separator} />;

export const AppLockScreenComponent: React.FC<AppLockScreenProps> = ({ navigation }) => {
  const lock = useAppLock();
  const [searchQuery, setSearchQuery] = useState('');
  const cachedApps = useAppLockStore(state => state.apps);
  const cachedLockedPackages = useAppLockStore(state => state.lockedPackages);
  const cachedHasAccessibility = useAppLockStore(state => state.hasAccessibility);
  const cachedHasOverlay = useAppLockStore(state => state.hasOverlay);
  const setAppsInStore = useAppLockStore(state => state.setApps);
  const setLockedPackagesInStore = useAppLockStore(state => state.setLockedPackages);
  const setPermissionsInStore = useAppLockStore(state => state.setPermissions);
  const [hasAccessibility, setHasAccessibility] = useState(cachedHasAccessibility);
  const [hasOverlay, setHasOverlay] = useState(cachedHasOverlay);

  const refreshAndroidPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      const [accessibilityEnabled, overlayEnabled] = await Promise.all([
        AppLock.android.isAccessibilityEnabled(),
        AppLock.android.canDrawOverlays(),
      ]);
      setHasAccessibility(accessibilityEnabled);
      setHasOverlay(overlayEnabled);
      setPermissionsInStore({
        hasAccessibility: accessibilityEnabled,
        hasOverlay: overlayEnabled,
      });
    } catch {
      // ignore and keep current state
    }
  }, [setPermissionsInStore]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    refreshAndroidPermissions();

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        refreshAndroidPermissions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshAndroidPermissions]);

  useEffect(() => {
    if (!lock.loading) {
      setAppsInStore(lock.apps);
    }
  }, [lock.apps, lock.loading, setAppsInStore]);

  useEffect(() => {
    if (!lock.loading) {
      setLockedPackagesInStore(Array.from(lock.lockedSet));
    }
  }, [lock.lockedSet, lock.loading, setLockedPackagesInStore]);

  const openAccessibilitySettings = useCallback(() => {
    lock.openAccessibilitySettings().catch(() => {
      Alert.alert('Error', 'Failed to open accessibility settings.');
    });
  }, [lock]);

  const openOverlaySettings = useCallback(() => {
    lock.openOverlaySettings().catch(() => {
      Alert.alert('Error', 'Failed to open overlay settings.');
    });
  }, [lock]);

  const handleToggle = useCallback(
    (pkg: string, shouldLock: boolean) => {
      if (Platform.OS === 'android' && !hasAccessibility) {
        Alert.alert(
          'Permission Required',
          'Enable App Lock service first: Settings > Accessibility > Installed apps > AppLock > Allow.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Accessibility Settings', onPress: openAccessibilitySettings },
          ],
        );
        return;
      }

      if (shouldLock) {
        lock.lockApp(pkg).catch(() => {
          Alert.alert('Error', 'Failed to lock app.');
        });
      } else {
        lock.unlockApp(pkg).catch(() => {
          Alert.alert('Error', 'Failed to unlock app.');
        });
      }
    },
    [hasAccessibility, lock, openAccessibilitySettings],
  );

  const handleUnlockAll = useCallback(() => {
    Alert.alert('Remove All Locks?', 'All apps will be unblocked.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => lock.unlockAll() },
    ]);
  }, [lock]);

  const handleIosPick = useCallback(async () => {
    const encoded = await lock.pickApps();
    if (encoded) {
      await lock.shieldFromEncoded(encoded);
      Alert.alert('Done', 'Selected apps are now locked via Screen Time.');
    }
  }, [lock]);

  const effectiveApps = useMemo(() => {
    if (lock.loading && cachedApps.length > 0) {
      return cachedApps;
    }
    return lock.apps;
  }, [lock.loading, lock.apps, cachedApps]);

  const effectiveLockedSet = useMemo(() => {
    if (lock.loading && cachedLockedPackages.length > 0) {
      return new Set(cachedLockedPackages);
    }
    return lock.lockedSet;
  }, [lock.loading, lock.lockedSet, cachedLockedPackages]);

  const filteredApps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return effectiveApps;
    }

    return effectiveApps.filter(app => {
      return (
        app.appName.toLowerCase().includes(query) ||
        app.packageName.toLowerCase().includes(query)
      );
    });
  }, [effectiveApps, searchQuery]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<InstalledApp>) => (
      <AppRow
        item={item}
        isLocked={effectiveLockedSet.has(item.packageName)}
        isSaving={lock.savingPkg === item.packageName}
        onToggle={handleToggle}
      />
    ),
    [effectiveLockedSet, lock.savingPkg, handleToggle],
  );

  const keyExtractor = useCallback((item: InstalledApp) => item.packageName, []);

  const lockedCount = effectiveLockedSet.size;
  const showLoading = lock.loading && cachedApps.length === 0;

  if (Platform.OS === 'ios') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>App Lock</Text>
          <View style={styles.backBtn} />
        </View>

        {showLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#FF6844" />
          </View>
        ) : lock.iosAuthStatus !== 'approved' ? (
          <View style={styles.center}>
            <Text style={styles.permTitle}>Screen Time Permission</Text>
            <Text style={styles.permDesc}>
              Tap "Grant Permission" then allow in iPhone Settings {'>'} Screen Time.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={lock.requestIosAuthorization}>
              <Text style={styles.primaryBtnText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.permTitle}>App Lock</Text>
            <Text style={styles.permDesc}>Select apps to lock using Screen Time picker.</Text>
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleIosPick}>
              <Text style={styles.primaryBtnText}>Select Apps to Lock</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn} activeOpacity={0.85} onPress={handleUnlockAll}>
              <Text style={styles.outlineBtnText}>Remove All Locks</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Lock</Text>
        <View style={styles.backBtn} />
      </View>

      {!hasAccessibility && (
        <View style={styles.permissionGuide}>
          <Text style={styles.permissionGuideTitle}>Enable App Lock Access</Text>
          <Text style={styles.permissionGuideText}>Button: Open Accessibility Settings</Text>
          <Text style={styles.permissionGuideText}>
            Location: Settings {'>'} Accessibility {'>'} Installed apps {'>'} AppLock {'>'} Allow.
          </Text>
          <TouchableOpacity style={styles.permActionBtn} onPress={openAccessibilitySettings}>
            <Text style={styles.permActionText}>Open Accessibility Settings</Text>
          </TouchableOpacity>

          {!hasOverlay && (
            <>
              <Text style={styles.permissionGuideText}>Button: Open Overlay Settings</Text>
              <Text style={styles.permissionGuideText}>Allow: Display over other apps.</Text>
              <TouchableOpacity style={styles.overlayButton} onPress={openOverlaySettings}>
                <Text style={styles.overlayButtonText}>Open Overlay Settings</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {!showLoading && (
        <View>
          <View style={styles.statsRow}>
            <Text style={styles.statsText}>
              {lockedCount > 0
                ? `${lockedCount} app${lockedCount > 1 ? 's' : ''} locked`
                : 'No apps locked'}
            </Text>
            {lockedCount > 0 && (
              <TouchableOpacity onPress={handleUnlockAll} activeOpacity={0.7}>
                <Text style={styles.unlockAllText}>Unlock all</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.searchWrap}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search app name or package"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
        </View>
      )}

      {showLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6844" />
        </View>
      ) : (
        <FlatList
          data={filteredApps}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={
            filteredApps.length === 0 ? styles.centerContent : styles.listContent
          }
          ItemSeparatorComponent={ItemSeparator}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={EmptyList}
        />
      )}
    </SafeAreaView>
  );
};

export default AppLockScreenComponent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 32,
    lineHeight: 36,
    marginTop: -4,
    color: '#070707',
  },
  headerTitle: {
    fontSize: 17,
    color: '#070707',
    fontFamily: 'Satoshi-Bold',
    flex: 1,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  centerContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permTitle: {
    fontSize: 20,
    color: '#070707',
    fontFamily: 'Satoshi-Bold',
    textAlign: 'center',
  },
  permDesc: {
    fontSize: 14,
    color: '#5F6266',
    fontFamily: 'Satoshi-Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#FF6844',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Satoshi-Bold',
  },
  outlineBtn: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  outlineBtnText: {
    color: '#DC2626',
    fontSize: 15,
    fontFamily: 'Satoshi-Medium',
  },
  permissionGuide: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    gap: 6,
  },
  permissionGuideTitle: {
    fontSize: 14,
    color: '#9A3412',
    fontFamily: 'Satoshi-Bold',
  },
  permissionGuideText: {
    fontSize: 12,
    color: '#7C2D12',
    fontFamily: 'Satoshi-Regular',
  },
  permActionBtn: {
    marginTop: 2,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: '#EA580C',
    alignItems: 'center',
  },
  permActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Satoshi-Bold',
  },
  overlayButton: {
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  overlayButtonText: {
    fontSize: 13,
    color: '#9A3412',
    fontFamily: 'Satoshi-Medium',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  statsText: {
    fontSize: 13,
    color: '#5F6266',
    fontFamily: 'Satoshi-Regular',
  },
  unlockAllText: {
    fontSize: 13,
    color: '#DC2626',
    fontFamily: 'Satoshi-Medium',
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#070707',
    fontFamily: 'Satoshi-Regular',
  },
  listContent: {
    paddingBottom: 40,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 76,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  appLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  appIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  appIconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIconLetter: {
    fontSize: 18,
    color: '#5F6266',
    fontFamily: 'Satoshi-Bold',
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 14,
    color: '#070707',
    fontFamily: 'Satoshi-Medium',
    marginBottom: 2,
  },
  appPkg: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'Satoshi-Regular',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'Satoshi-Regular',
    textAlign: 'center',
  },
});
