package com.estebanmm13.pytra;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import org.json.JSONException;

/**
 * Daily foreground time of installed apps, from the system's usage events (UsageStatsManager), for the
 * Android play time sync (UsageStatsService on the TypeScript side). Needs the special "Usage access"
 * permission, granted by the user in the system settings.
 */
@CapacitorPlugin(name = "UsageStats")
public class UsageStatsPlugin extends Plugin {

    /** The users' zone: days are cut at its midnights, like the API (app.time-zone). */
    static final String DEFAULT_TIME_ZONE = "Europe/Madrid";
    /** Events of an app already in the foreground at the range start are looked for this far back. */
    private static final long LOOKBACK_MS = 24L * 60 * 60 * 1000;

    /** Whether Pytra has "Usage access". */
    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("value", hasUsageAccess());
        call.resolve(result);
    }

    /** Opens the system "Usage access" settings screen. */
    @PluginMethod
    public void openPermissionSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("Usage access settings unavailable", e);
        }
    }

    /** Apps with a launcher icon (except Pytra): [{packageName, label, isGame}], sorted by label. */
    @PluginMethod
    public void listLaunchableApps(PluginCall call) {
        PackageManager packageManager = getContext().getPackageManager();
        Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> activities = packageManager.queryIntentActivities(launcher, 0);
        Set<String> seen = new HashSet<>();
        List<JSObject> apps = new ArrayList<>();
        for (ResolveInfo info : activities) {
            String packageName = info.activityInfo.packageName;
            if (packageName.equals(getContext().getPackageName()) || !seen.add(packageName)) {
                continue;
            }
            ApplicationInfo application = info.activityInfo.applicationInfo;
            JSObject app = new JSObject();
            app.put("packageName", packageName);
            app.put("label", String.valueOf(info.loadLabel(packageManager)));
            app.put("isGame", isGame(application));
            apps.add(app);
        }
        Collections.sort(apps, (a, b) -> a.getString("label", "").compareToIgnoreCase(b.getString("label", "")));
        JSObject result = new JSObject();
        result.put("apps", new JSArray(apps));
        call.resolve(result);
    }

    /**
     * Foreground minutes per local day of the given packages between {@code from} and {@code to}
     * (yyyy-MM-dd, both included): {apps: [{date, packageName, minutes}]}. Only days with at least one
     * minute are returned. Android keeps about 7-10 days of events; older days come back empty.
     */
    @PluginMethod
    public void getDailyUsage(PluginCall call) {
        if (!hasUsageAccess()) {
            call.reject("Usage access not granted", "PERMISSION_DENIED");
            return;
        }
        TimeZone zone = TimeZone.getTimeZone(call.getString("timeZone", DEFAULT_TIME_ZONE));
        long rangeStart = DailyUsageCalculator.parseDayStart(call.getString("from"), zone);
        // End (exclusive) = start of the day after `to`, in the zone (a DST day is 23 or 25 hours long).
        long afterTo = DailyUsageCalculator.parseDayStart(nextDay(call.getString("to")), zone);
        if (rangeStart < 0 || afterTo < 0 || afterTo <= rangeStart) {
            call.reject("Invalid from/to");
            return;
        }
        Set<String> packages = new HashSet<>();
        JSArray requested = call.getArray("packages", new JSArray());
        try {
            for (int i = 0; i < requested.length(); i++) {
                packages.add(requested.getString(i));
            }
        } catch (JSONException e) {
            call.reject("Invalid packages", e);
            return;
        }

        long rangeEnd = Math.min(System.currentTimeMillis(), afterTo);
        DailyUsageCalculator calculator = new DailyUsageCalculator(zone, rangeStart, rangeEnd, packages);
        if (!packages.isEmpty() && rangeEnd > rangeStart) {
            UsageStatsManager manager = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
            UsageEvents events = manager.queryEvents(rangeStart - LOOKBACK_MS, rangeEnd);
            UsageEvents.Event event = new UsageEvents.Event();
            while (events != null && events.hasNextEvent()) {
                events.getNextEvent(event);
                int type = event.getEventType();
                if (type == foregroundEvent()) {
                    calculator.onEvent(event.getPackageName(), true, event.getTimeStamp());
                } else if (type == backgroundEvent()) {
                    calculator.onEvent(event.getPackageName(), false, event.getTimeStamp());
                }
            }
        }

        JSArray days = new JSArray();
        for (DailyUsageCalculator.DayUsage usage : calculator.result()) {
            JSObject day = new JSObject();
            day.put("date", usage.date);
            day.put("packageName", usage.packageName);
            day.put("minutes", usage.minutes);
            days.put(day);
        }
        JSObject result = new JSObject();
        result.put("days", days);
        call.resolve(result);
    }

    private boolean hasUsageAccess() {
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getContext().getPackageName())
            : appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getContext().getPackageName());
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    private static boolean isGame(ApplicationInfo application) {
        if (application == null) {
            return false;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && application.category == ApplicationInfo.CATEGORY_GAME) {
            return true;
        }
        // Older flag, still set by many games.
        return (application.flags & ApplicationInfo.FLAG_IS_GAME) != 0;
    }

    @SuppressWarnings("deprecation")
    private static int foregroundEvent() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? UsageEvents.Event.ACTIVITY_RESUMED
            : UsageEvents.Event.MOVE_TO_FOREGROUND;
    }

    @SuppressWarnings("deprecation")
    private static int backgroundEvent() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? UsageEvents.Event.ACTIVITY_PAUSED
            : UsageEvents.Event.MOVE_TO_BACKGROUND;
    }

    /** yyyy-MM-dd of the day after {@code date} (calendar arithmetic, no time zone involved). */
    private static String nextDay(String date) {
        TimeZone utc = TimeZone.getTimeZone("UTC");
        long start = DailyUsageCalculator.parseDayStart(date, utc);
        if (start < 0) {
            return null;
        }
        java.util.Calendar calendar = java.util.Calendar.getInstance(utc, Locale.ROOT);
        calendar.setTimeInMillis(start);
        calendar.add(java.util.Calendar.DAY_OF_MONTH, 1);
        return String.format(Locale.ROOT, "%04d-%02d-%02d", calendar.get(java.util.Calendar.YEAR),
            calendar.get(java.util.Calendar.MONTH) + 1, calendar.get(java.util.Calendar.DAY_OF_MONTH));
    }
}
