package com.vibtek.northrealm;

import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

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
    super.onCreate(savedInstanceState);

    // Extra safety: if any layout still draws under system bars, apply top inset padding to the root content.
    final View content = findViewById(android.R.id.content);
    if (content != null) {
      ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
        Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
        // Keep existing left/right/bottom padding; only enforce top padding.
        v.setPadding(v.getPaddingLeft(), bars.top, v.getPaddingRight(), v.getPaddingBottom());
        return insets;
      });
      ViewCompat.requestApplyInsets(content);
    }
  }
}
