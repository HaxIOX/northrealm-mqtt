import { useEffect, useRef, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, getFirestore, onSnapshot, setDoc } from 'firebase/firestore';
import { decryptJson, encryptJson } from '../mqtt/e2ee.js';
import { validateAndFixConfig } from '../utils/mqtt-helpers.js';
import {
  readLocalStorageFlag,
  readLocalStorageString,
  readSessionStorageFlag,
  readSessionStorageString,
  removeLocalStorageItem,
  removeSessionStorageItem,
  writeLocalStorageFlag,
  writeLocalStorageJson,
  writeLocalStorageString,
  writeSessionStorageFlag,
  writeSessionStorageString,
} from './useLocalStorage.js';

let app;
let auth;
let db;
let isFirebaseAvailable = false;
let appId = 'default-app-id';

try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseAvailable = true;

    if (typeof __app_id !== 'undefined') appId = __app_id;
  } else {
    console.warn('未检测到 __firebase_config，应用将以【仅本地模式】运行。云同步功能不可用。');
  }
} catch (error) {
  console.error('Firebase 初始化失败，降级为本地模式:', error);
}

export { isFirebaseAvailable };

export function useAppCloudSyncState({
  addLog,
  isDesktopShell,
  lastSubscriptionsRef,
  multicastTargetsRef,
  quickActionsRef,
  savedConfigsRef,
  setMulticastTargets,
  setQuickActions,
  setSavedConfigs,
  setSubscriptions,
}) {
  const [user, setUser] = useState(null);
  const [syncSpaceId, setSyncSpaceId] = useState('');
  const [inputSpaceId, setInputSpaceId] = useState('');
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncEncryptEnabled, setSyncEncryptEnabled] = useState(() => readLocalStorageFlag('mqtt_sync_encrypt', true));
  const [syncPassphrase, setSyncPassphrase] = useState(() => readSessionStorageString('mqtt_sync_passphrase', ''));
  const [rememberPassphrase, setRememberPassphrase] = useState(() => readSessionStorageFlag('mqtt_sync_remember', false));
  const [cloudCryptoError, setCloudCryptoError] = useState('');

  const saveToCloudRef = useRef(null);

  useEffect(() => {
    writeLocalStorageFlag('mqtt_sync_encrypt', syncEncryptEnabled);
  }, [syncEncryptEnabled]);

  useEffect(() => {
    writeSessionStorageFlag('mqtt_sync_remember', rememberPassphrase);
    if (rememberPassphrase) writeSessionStorageString('mqtt_sync_passphrase', syncPassphrase);
    else removeSessionStorageItem('mqtt_sync_passphrase');
  }, [rememberPassphrase, syncPassphrase]);

  useEffect(() => {
    try {
      const lastSyncId = readLocalStorageString('mqtt_sync_id', '');
      if (!lastSyncId) return;
      setSyncSpaceId(lastSyncId);
      setInputSpaceId(lastSyncId);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseAvailable || !auth) return undefined;

    signInAnonymously(auth).catch((error) => {
      console.error('Auth failed:', error);
    });

    return onAuthStateChanged(auth, setUser);
  }, []);

  const saveToCloud = async (newConfigs, newActions, newSubscriptions, newMulticastTargets) => {
    if (!isFirebaseAvailable || !user || !syncSpaceId) return;

    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', `mqtt_space_${syncSpaceId}`);
      const mergedPayload = {
        configs: newConfigs ?? savedConfigsRef.current,
        actions: newActions ?? quickActionsRef.current,
        subscriptions: newSubscriptions ?? lastSubscriptionsRef.current,
        multicastTargets: newMulticastTargets ?? multicastTargetsRef.current,
      };

      if (syncEncryptEnabled) {
        if (!syncPassphrase) throw new Error('云同步已启用加密，但未输入口令');
        const enc = await encryptJson(syncPassphrase, mergedPayload);
        await setDoc(docRef, { enc, encrypted: true, updatedAt: Date.now(), updatedBy: user.uid }, { merge: true });
        return;
      }

      await setDoc(docRef, {
        configs: mergedPayload.configs,
        actions: mergedPayload.actions,
        subscriptions: mergedPayload.subscriptions,
        multicastTargets: mergedPayload.multicastTargets,
        encrypted: false,
        updatedAt: Date.now(),
        updatedBy: user.uid,
      }, { merge: true });
    } catch {
      addLog('error', '', '云端保存失败');
    }
  };
  saveToCloudRef.current = saveToCloud;

  useEffect(() => {
    if (!isFirebaseAvailable || !user || !syncSpaceId) {
      setIsCloudConnected(false);
      return undefined;
    }

    const applyPayload = (payload) => {
      if (Array.isArray(payload?.configs)) {
        const validatedConfigs = payload.configs.map((config) => validateAndFixConfig(config, isDesktopShell));
        savedConfigsRef.current = validatedConfigs;
        setSavedConfigs(validatedConfigs);
        writeLocalStorageJson('mqtt_configs', validatedConfigs);
      }

      if (Array.isArray(payload?.actions)) {
        quickActionsRef.current = payload.actions;
        setQuickActions(payload.actions);
        writeLocalStorageJson('mqtt_quick_actions', payload.actions);
      }

      if (Array.isArray(payload?.subscriptions)) {
        lastSubscriptionsRef.current = payload.subscriptions;
        setSubscriptions(payload.subscriptions);
        writeLocalStorageJson('mqtt_subscriptions', payload.subscriptions);
      }

      if (Array.isArray(payload?.multicastTargets)) {
        multicastTargetsRef.current = payload.multicastTargets;
        setMulticastTargets(payload.multicastTargets);
        writeLocalStorageJson('mqtt_multicast_targets', payload.multicastTargets);
      }
    };

    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', `mqtt_space_${syncSpaceId}`);
      setIsCloudConnected(true);
      setCloudCryptoError('');
      addLog('system', '', `已连接云同步空间: ${syncSpaceId}`);

      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (!docSnap.exists()) {
          saveToCloudRef.current?.(
            savedConfigsRef.current,
            quickActionsRef.current,
            lastSubscriptionsRef.current,
            multicastTargetsRef.current,
          );
          return;
        }

        const data = docSnap.data();
        if (data.enc) {
          if (!syncPassphrase) {
            setCloudCryptoError('该 Space ID 使用了端到端加密，需要输入口令才能同步。');
            addLog('error', '', '云同步需要口令：请在"云同步"里输入口令后重新连接。');
            return;
          }

          decryptJson(syncPassphrase, data.enc)
            .then((payload) => {
              setCloudCryptoError('');
              applyPayload(payload);
            })
            .catch((error) => {
              const message = `解密失败：${String(error?.message || error)}`;
              setCloudCryptoError(message);
              addLog('error', '', message);
            });
          return;
        }

        applyPayload(data);
      }, (error) => {
        console.error('Sync error:', error);
        setIsCloudConnected(false);
        addLog('error', '', '云同步连接中断');
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Firestore init error', error);
      setIsCloudConnected(false);
      return undefined;
    }
  }, [
    addLog,
    isDesktopShell,
    lastSubscriptionsRef,
    multicastTargetsRef,
    quickActionsRef,
    savedConfigsRef,
    setMulticastTargets,
    setQuickActions,
    setSavedConfigs,
    setSubscriptions,
    syncPassphrase,
    syncSpaceId,
    user,
  ]);

  const handleConnectSync = () => {
    if (!isFirebaseAvailable) {
      alert('当前环境未配置 Firebase，无法使用云同步功能。请检查配置或仅使用本地功能。');
      return;
    }
    if (!inputSpaceId.trim()) return;
    if (syncEncryptEnabled && !syncPassphrase) {
      alert('已启用端到端加密：请先输入"同步口令"。');
      return;
    }

    const id = inputSpaceId.trim();
    setSyncSpaceId(id);
    writeLocalStorageString('mqtt_sync_id', id);
    setShowSyncModal(false);
  };

  const handleDisconnectSync = () => {
    setSyncSpaceId('');
    removeLocalStorageItem('mqtt_sync_id');
    setIsCloudConnected(false);
    setShowSyncModal(false);
    addLog('system', '', '已断开云同步');
  };

  return {
    cloudCryptoError,
    handleConnectSync,
    handleDisconnectSync,
    inputSpaceId,
    isCloudConnected,
    rememberPassphrase,
    saveToCloud,
    setInputSpaceId,
    setRememberPassphrase,
    setShowSyncModal,
    setSyncEncryptEnabled,
    setSyncPassphrase,
    showSyncModal,
    syncEncryptEnabled,
    syncPassphrase,
    syncSpaceId,
    user,
  };
}
