import { useCallback, useEffect, useRef, useState } from 'react';
import { runMqttConnectionProbe } from '../utils/mqtt-probe.js';

export function useMqttConnectionProbe({
  advancedConfig,
  connection,
  isDesktopShell,
  mqtt,
  tcpCapable,
}) {
  const [isTesting, setIsTesting] = useState(false);
  const [probeResult, setProbeResult] = useState(null);
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(true);
  const probeConfigKey = JSON.stringify({ advancedConfig, connection });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const testConnection = useCallback(async () => {
    if (inFlightRef.current) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    inFlightRef.current = true;
    setIsTesting(true);
    setProbeResult(null);

    const result = await runMqttConnectionProbe({
      advancedConfig,
      connection,
      isDesktopShell,
      mqtt,
      signal: controller.signal,
      tcpCapable,
    });

    if (!mountedRef.current || abortControllerRef.current !== controller) return;
    abortControllerRef.current = null;
    inFlightRef.current = false;
    setIsTesting(false);
    setProbeResult({ ...result, configKey: probeConfigKey });
  }, [advancedConfig, connection, isDesktopShell, mqtt, probeConfigKey, tcpCapable]);

  return {
    isTesting,
    probeResult: probeResult?.configKey === probeConfigKey ? probeResult : null,
    testConnection,
  };
}
