package com.vibtek.northrealm;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import org.eclipse.paho.client.mqttv3.DisconnectedBufferOptions;
import org.eclipse.paho.client.mqttv3.IMqttActionListener;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.IMqttToken;
import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;

@CapacitorPlugin(name = "NativeMqtt")
public class NativeMqttPlugin extends Plugin {
    private final Object lock = new Object();
    private MqttAsyncClient client;
    private boolean manualDisconnect;

    private static String normalizeServerUri(String url) {
        if (url.startsWith("mqtt://")) return "tcp://" + url.substring(7);
        if (url.startsWith("mqtts://")) return "ssl://" + url.substring(8);
        return url;
    }

    private void emit(String eventName, JSObject data) {
        notifyListeners(eventName, data == null ? new JSObject() : data, true);
    }

    private void emitError(String message, Throwable error) {
        JSObject data = new JSObject();
        data.put("message", message);
        if (error != null) {
            data.put("exception", error.getClass().getSimpleName());
            data.put("details", error.getMessage());
            if (error instanceof MqttException) data.put("code", ((MqttException) error).getReasonCode());
        }
        emit("error", data);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String url = call.getString("url", "");
        String clientId = call.getString("clientId", "");
        if (url.isEmpty() || clientId.isEmpty()) {
            call.reject("url and clientId are required");
            return;
        }

        try {
            synchronized (lock) {
                if (client != null) {
                    try { client.disconnectForcibly(0, 0); } catch (Exception ignored) {}
                    try { client.close(); } catch (Exception ignored) {}
                }
                manualDisconnect = false;
                client = new MqttAsyncClient(normalizeServerUri(url), clientId, new MemoryPersistence());
                client.setCallback(new MqttCallbackExtended() {
                    @Override
                    public void connectComplete(boolean reconnect, String serverURI) {
                        JSObject event = new JSObject();
                        event.put("sessionPresent", false);
                        event.put("reconnect", reconnect);
                        emit("connect", event);
                    }

                    @Override
                    public void connectionLost(Throwable cause) {
                        if (manualDisconnect) return;
                        emit("offline", new JSObject());
                        emit("reconnect", new JSObject());
                        emitError("MQTT connection lost", cause);
                    }

                    @Override
                    public void messageArrived(String topic, MqttMessage message) {
                        JSObject event = new JSObject();
                        event.put("topic", topic);
                        event.put("payload", new String(message.getPayload(), StandardCharsets.UTF_8));
                        event.put("qos", message.getQos());
                        event.put("retain", message.isRetained());
                        event.put("dup", message.isDuplicate());
                        emit("message", event);
                    }

                    @Override
                    public void deliveryComplete(IMqttDeliveryToken token) {}
                });

                MqttConnectOptions options = new MqttConnectOptions();
                options.setCleanSession(call.getBoolean("clean", true));
                options.setKeepAliveInterval(call.getInt("keepalive", 60));
                options.setConnectionTimeout(Math.max(1, call.getInt("connectTimeoutMs", 10000) / 1000));
                options.setAutomaticReconnect(call.getInt("reconnectPeriodMs", 0) > 0);
                String username = call.getString("username", "");
                String password = call.getString("password", "");
                if (!username.isEmpty()) options.setUserName(username);
                if (!password.isEmpty()) options.setPassword(password.toCharArray());

                DisconnectedBufferOptions buffer = new DisconnectedBufferOptions();
                buffer.setBufferEnabled(true);
                buffer.setBufferSize(100);
                buffer.setPersistBuffer(false);
                buffer.setDeleteOldestMessages(true);
                client.setBufferOpts(buffer);
                client.connect(options, null, new IMqttActionListener() {
                    @Override
                    public void onSuccess(IMqttToken asyncActionToken) { call.resolve(); }

                    @Override
                    public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
                        emitError("MQTT connection failed", exception);
                        Exception cause = exception instanceof Exception
                            ? (Exception) exception
                            : new Exception(exception);
                        call.reject("MQTT connection failed", cause);
                    }
                });
            }
        } catch (Exception error) {
            emitError("MQTT initialization failed", error);
            call.reject("MQTT initialization failed", error);
        }
    }

    @PluginMethod
    public void subscribe(PluginCall call) {
        MqttAsyncClient current = client;
        if (current == null || !current.isConnected()) {
            call.reject("MQTT client is not connected");
            return;
        }
        try {
            current.subscribe(call.getString("topic", ""), call.getInt("qos", 0)).waitForCompletion();
            call.resolve();
        } catch (Exception error) {
            call.reject("Subscribe failed", error);
        }
    }

    @PluginMethod
    public void unsubscribe(PluginCall call) {
        MqttAsyncClient current = client;
        if (current == null || !current.isConnected()) {
            call.reject("MQTT client is not connected");
            return;
        }
        try {
            current.unsubscribe(call.getString("topic", "")).waitForCompletion();
            call.resolve();
        } catch (Exception error) {
            call.reject("Unsubscribe failed", error);
        }
    }

    @PluginMethod
    public void publish(PluginCall call) {
        MqttAsyncClient current = client;
        if (current == null || !current.isConnected()) {
            call.reject("MQTT client is not connected");
            return;
        }
        try {
            MqttMessage message = new MqttMessage(call.getString("payload", "").getBytes(StandardCharsets.UTF_8));
            message.setQos(call.getInt("qos", 0));
            message.setRetained(call.getBoolean("retain", false));
            current.publish(call.getString("topic", ""), message).waitForCompletion();
            call.resolve();
        } catch (Exception error) {
            call.reject("Publish failed", error);
        }
    }

    @PluginMethod
    public void end(PluginCall call) {
        MqttAsyncClient current;
        synchronized (lock) {
            manualDisconnect = true;
            current = client;
            client = null;
        }
        try {
            if (current != null) {
                if (current.isConnected()) current.disconnectForcibly(0, 0);
                current.close();
            }
            emit("close", new JSObject());
            call.resolve();
        } catch (Exception error) {
            call.reject("Disconnect failed", error);
        }
    }
}
