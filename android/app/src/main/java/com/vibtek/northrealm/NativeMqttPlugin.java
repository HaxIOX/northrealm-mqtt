package com.vibtek.northrealm;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.eclipse.paho.client.mqttv3.IMqttActionListener;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.IMqttToken;
import org.eclipse.paho.client.mqttv3.MqttAsyncClient;
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@CapacitorPlugin(name = "NativeMqtt")
public class NativeMqttPlugin extends Plugin {

  private final Object lock = new Object();
  private MqttAsyncClient client;
  private boolean manualDisconnect = false;
  private int reconnectCount = 0;

  private void emitError(String message, Throwable t) {
    JSObject obj = new JSObject();
    String msg = message != null ? message : "Native MQTT error";
    if (t != null && t.getMessage() != null && !t.getMessage().isEmpty() && !msg.contains(t.getMessage())) {
      msg = msg + ": " + t.getMessage();
    }
    obj.put("message", msg);
    if (t != null) {
      obj.put("exception", t.getClass().getName());
      obj.put("details", String.valueOf(t));
      if (t instanceof MqttException) {
        try {
          int reasonCode = ((MqttException) t).getReasonCode();
          obj.put("reasonCode", reasonCode);
          // Keep compatibility with JS error parsing that expects err.code sometimes.
          obj.put("code", reasonCode);
        } catch (Exception ignored) {
          // ignore
        }
      }
    }
    notifyListeners("error", obj);
  }

  private static String normalizeServerUri(String url) {
    if (url == null) return "";
    String u = url.trim();
    if (u.startsWith("mqtts://")) return "ssl://" + u.substring("mqtts://".length());
    if (u.startsWith("mqtt://")) return "tcp://" + u.substring("mqtt://".length());
    // Allow power users to pass tcp:// or ssl:// directly.
    return u;
  }

  @PluginMethod
  public void connect(PluginCall call) {
    String url = call.getString("url");
    if (url == null || url.trim().isEmpty()) {
      call.reject("url is required");
      return;
    }

    String serverUri = normalizeServerUri(url);
    String clientId = call.getString("clientId");
    if (clientId == null || clientId.trim().isEmpty()) {
      clientId = "nr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    String username = call.getString("username", "");
    String password = call.getString("password", "");
    boolean clean = Boolean.TRUE.equals(call.getBoolean("clean", true));
    int keepalive = call.getInt("keepalive", 60);
    int connectTimeoutMs = call.getInt("connectTimeoutMs", 10_000);
    int reconnectPeriodMs = call.getInt("reconnectPeriodMs", 0);

    final String resolvedClientId = clientId;
    final String resolvedServerUri = serverUri;

    final MqttAsyncClient nextClient;
    try {
      nextClient = new MqttAsyncClient(resolvedServerUri, resolvedClientId, new MemoryPersistence());
    } catch (MqttException e) {
      call.reject("create client failed: " + e.getMessage());
      return;
    }

    final MqttConnectOptions opts = new MqttConnectOptions();
    opts.setCleanSession(clean);
    opts.setKeepAliveInterval(Math.max(0, keepalive));
    opts.setConnectionTimeout(Math.max(1, connectTimeoutMs / 1000));
    opts.setAutomaticReconnect(reconnectPeriodMs > 0);
    if (username != null && !username.isEmpty()) opts.setUserName(username);
    if (password != null && !password.isEmpty()) opts.setPassword(password.toCharArray());

    nextClient.setCallback(new MqttCallbackExtended() {
      @Override
      public void connectComplete(boolean reconnect, String serverURI) {
        synchronized (lock) {
          manualDisconnect = false;
          if (reconnect) reconnectCount++;
        }

        JSObject ev = new JSObject();
        ev.put("reconnect", reconnect);
        ev.put("serverURI", serverURI);
        notifyListeners("connect", ev);
        if (reconnect) {
          JSObject r = new JSObject();
          r.put("count", reconnectCount);
          notifyListeners("reconnect", r);
        }
      }

      @Override
      public void connectionLost(Throwable cause) {
        boolean manual;
        synchronized (lock) {
          manual = manualDisconnect;
        }

        if (manual) {
          JSObject ev = new JSObject();
          notifyListeners("close", ev);
          return;
        }

        JSObject ev = new JSObject();
        ev.put("message", cause != null ? String.valueOf(cause.getMessage()) : "connection lost");
        notifyListeners("offline", ev);
        emitError(ev.getString("message"), cause);
      }

      @Override
      public void messageArrived(String topic, MqttMessage message) {
        JSObject ev = new JSObject();
        ev.put("topic", topic != null ? topic : "");
        String payload = "";
        try {
          payload = new String(message.getPayload(), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
          // ignore
        }
        ev.put("payload", payload);
        ev.put("qos", message.getQos());
        ev.put("retain", message.isRetained());
        ev.put("dup", message.isDuplicate());
        notifyListeners("message", ev);
      }

      @Override
      public void deliveryComplete(IMqttDeliveryToken token) {
        // no-op: App already logs publish by callback.
      }
    });

    // Replace old connection (single-session; UI only uses one client).
    synchronized (lock) {
      manualDisconnect = true;
      reconnectCount = 0;
      if (client != null) {
        try {
          if (client.isConnected()) client.disconnectForcibly();
          client.close();
        } catch (Exception ignored) {
          // ignore
        }
      }
      client = nextClient;
    }

    try {
      nextClient.connect(opts, null, new IMqttActionListener() {
        @Override
        public void onSuccess(IMqttToken asyncActionToken) {
          JSObject res = new JSObject();
          res.put("clientId", resolvedClientId);
          res.put("serverURI", resolvedServerUri);
          call.resolve(res);
        }

        @Override
        public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
          emitError("connect failed", exception);
          call.reject("connect failed: " + (exception != null ? exception.getMessage() : "unknown"));
        }
      });
    } catch (MqttException e) {
      emitError("connect threw", e);
      call.reject("connect error: " + e.getMessage());
    }
  }

  @PluginMethod
  public void subscribe(PluginCall call) {
    String topic = call.getString("topic");
    int qos = call.getInt("qos", 0);
    MqttAsyncClient c;
    synchronized (lock) {
      c = client;
    }
    if (c == null) {
      call.reject("not connected");
      return;
    }

    try {
      c.subscribe(topic, qos, null, new IMqttActionListener() {
        @Override
        public void onSuccess(IMqttToken asyncActionToken) {
          call.resolve();
        }

        @Override
        public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
          call.reject("subscribe failed: " + (exception != null ? exception.getMessage() : "unknown"));
        }
      });
    } catch (MqttException e) {
      call.reject("subscribe error: " + e.getMessage());
    }
  }

  @PluginMethod
  public void unsubscribe(PluginCall call) {
    String topic = call.getString("topic");
    MqttAsyncClient c;
    synchronized (lock) {
      c = client;
    }
    if (c == null) {
      call.reject("not connected");
      return;
    }

    try {
      c.unsubscribe(topic, null, new IMqttActionListener() {
        @Override
        public void onSuccess(IMqttToken asyncActionToken) {
          call.resolve();
        }

        @Override
        public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
          call.reject("unsubscribe failed: " + (exception != null ? exception.getMessage() : "unknown"));
        }
      });
    } catch (MqttException e) {
      call.reject("unsubscribe error: " + e.getMessage());
    }
  }

  @PluginMethod
  public void publish(PluginCall call) {
    String topic = call.getString("topic");
    String payload = call.getString("payload", "");
    int qos = call.getInt("qos", 0);
    boolean retain = Boolean.TRUE.equals(call.getBoolean("retain", false));

    MqttAsyncClient c;
    synchronized (lock) {
      c = client;
    }
    if (c == null) {
      call.reject("not connected");
      return;
    }

    MqttMessage msg = new MqttMessage(payload != null ? payload.getBytes(StandardCharsets.UTF_8) : new byte[0]);
    msg.setQos(qos);
    msg.setRetained(retain);

    try {
      c.publish(topic, msg, null, new IMqttActionListener() {
        @Override
        public void onSuccess(IMqttToken asyncActionToken) {
          call.resolve();
        }

        @Override
        public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
          call.reject("publish failed: " + (exception != null ? exception.getMessage() : "unknown"));
        }
      });
    } catch (MqttException e) {
      call.reject("publish error: " + e.getMessage());
    }
  }

  @PluginMethod
  public void end(PluginCall call) {
    boolean force = Boolean.TRUE.equals(call.getBoolean("force", true));
    MqttAsyncClient c;
    synchronized (lock) {
      manualDisconnect = true;
      c = client;
      client = null;
    }

    if (c == null) {
      JSObject ev = new JSObject();
      notifyListeners("close", ev);
      call.resolve();
      return;
    }

    if (force) {
      try {
        c.disconnectForcibly();
      } catch (Exception ignored) {
        // ignore
      }
      try {
        c.close();
      } catch (Exception ignored) {
        // ignore
      }
      JSObject ev = new JSObject();
      notifyListeners("close", ev);
      call.resolve();
      return;
    }

    try {
      c.disconnect(null, new IMqttActionListener() {
        @Override
        public void onSuccess(IMqttToken asyncActionToken) {
          try {
            c.close();
          } catch (Exception ignored) {
            // ignore
          }
          JSObject ev = new JSObject();
          notifyListeners("close", ev);
          call.resolve();
        }

        @Override
        public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
          try {
            c.disconnectForcibly();
          } catch (Exception ignored) {
            // ignore
          }
          try {
            c.close();
          } catch (Exception ignored) {
            // ignore
          }
          JSObject ev = new JSObject();
          notifyListeners("close", ev);
          call.resolve();
        }
      });
    } catch (MqttException e) {
      try {
        c.disconnectForcibly();
      } catch (Exception ignored) {
        // ignore
      }
      try {
        c.close();
      } catch (Exception ignored) {
        // ignore
      }
      JSObject ev = new JSObject();
      notifyListeners("close", ev);
      call.resolve();
    }
  }
}
