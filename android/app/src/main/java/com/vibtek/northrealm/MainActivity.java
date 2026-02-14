package com.vibtek.northrealm;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Must register plugins before BridgeActivity.onCreate() builds the bridge,
    // otherwise JS will report "plugin is not implemented".
    registerPlugin(NativeMqttPlugin.class);

    // Prevent the WebView content from drawing under the system status bar (fix header overlap on phones).
    // Do this before BridgeActivity sets the content view.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

    // Hard-set IME behavior to avoid WebView resize-induced focus glitches on some Android devices.
    // (Manifest can be overridden by framework/library; doing it here is more reliable.)
    getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN);
    super.onCreate(savedInstanceState);
  }
}
