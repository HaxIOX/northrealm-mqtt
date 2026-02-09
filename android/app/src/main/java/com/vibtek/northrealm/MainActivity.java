package com.vibtek.northrealm;

import android.os.Bundle;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Must register plugins before BridgeActivity.onCreate() builds the bridge,
    // otherwise JS will report "plugin is not implemented".
    registerPlugin(NativeMqttPlugin.class);
    super.onCreate(savedInstanceState);

    // Prevent the WebView content from drawing under the status bar (fix header overlap on phones).
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
  }
}
