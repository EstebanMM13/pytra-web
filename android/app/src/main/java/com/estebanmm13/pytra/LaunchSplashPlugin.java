package com.estebanmm13.pytra;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Keeps the system splash on screen until the web app has painted its first frame, so the
 * launch never shows an empty background (MainActivity installs the splash and polls
 * {@link #isHolding()}). The web side calls {@code hide()} right after its first render
 * (LaunchSplash on the TypeScript side); MainActivity also releases it after a timeout so a
 * failed web load never leaves the splash up.
 */
@CapacitorPlugin(name = "LaunchSplash")
public class LaunchSplashPlugin extends Plugin {

    private static volatile boolean holding = true;

    /** Called by MainActivity on every launch, before the splash is installed. */
    static void hold() {
        holding = true;
    }

    static void release() {
        holding = false;
    }

    static boolean isHolding() {
        return holding;
    }

    /** The web app has painted: let the system splash go. */
    @PluginMethod
    public void hide(PluginCall call) {
        release();
        call.resolve();
    }
}
