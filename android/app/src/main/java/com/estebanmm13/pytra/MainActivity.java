package com.estebanmm13.pytra;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Longest the system splash waits for the web app before leaving anyway. */
    private static final long SPLASH_MAX_HOLD_MS = 3000;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The system splash stays until the web app has painted (LaunchSplashPlugin.hide), so the
        // in-app intro takes over on the very next frame instead of after an empty background.
        LaunchSplashPlugin.hold();
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        splash.setKeepOnScreenCondition(LaunchSplashPlugin::isHolding);
        new Handler(Looper.getMainLooper()).postDelayed(LaunchSplashPlugin::release, SPLASH_MAX_HOLD_MS);

        // Local plugins must be registered before the bridge starts.
        registerPlugin(ApkInstallerPlugin.class);
        registerPlugin(UsageStatsPlugin.class);
        registerPlugin(LaunchSplashPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
