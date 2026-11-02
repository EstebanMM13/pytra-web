package com.estebanmm13.pytra;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.TreeMap;

/**
 * Foreground time per package and local day, built from the system's usage events.
 *
 * <p>A phone shows one app at a time, so the calculator follows "the app in the foreground": a session starts
 * when an app is resumed and ends at the first of: that app paused or stopped, ANOTHER app resumed, the screen
 * turned off or locked, or the device shut down. Usage events are often incomplete (a game killed in the
 * background never logs its pause); ending a session when anything else takes the screen keeps a missing pause
 * from stretching a session over hours or days. A session longer than {@link #MAX_SESSION_MS} is still treated
 * as corrupt and dropped, and one still open when the events end too (while Pytra asks, no other app is shown).
 *
 * <p>Kept sessions of the requested packages are clipped to [rangeStart, rangeEnd) and split at the local
 * midnights of {@code zone}. Events of every app must be fed, not only the requested ones. Pure Java (no Android
 * types) so it is unit-tested on the JVM.
 */
final class DailyUsageCalculator {

    /** No real phone session lasts this long without the screen turning off. */
    static final long MAX_SESSION_MS = 12L * 60 * 60 * 1000;

    /** One package's foreground minutes on one local day. */
    static final class DayUsage {
        final String date;
        final String packageName;
        final long minutes;

        DayUsage(String date, String packageName, long minutes) {
            this.date = date;
            this.packageName = packageName;
            this.minutes = minutes;
        }
    }

    private final TimeZone zone;
    private final long rangeStart;
    private final long rangeEnd;
    private final Set<String> packages;
    /** The app in the foreground, or null. */
    private String current;
    private long since;
    /** "yyyy-MM-dd|package" -> milliseconds, sorted so the result is stable. */
    private final Map<String, Long> totals = new TreeMap<>();

    DailyUsageCalculator(TimeZone zone, long rangeStart, long rangeEnd, Set<String> packages) {
        this.zone = zone;
        this.rangeStart = rangeStart;
        this.rangeEnd = rangeEnd;
        this.packages = packages;
    }

    /** An activity of {@code packageName} was resumed (any app, in time order). */
    void onResumed(String packageName, long timestamp) {
        if (packageName == null || packageName.equals(current)) {
            return;
        }
        end(timestamp);
        current = packageName;
        since = timestamp;
    }

    /** An activity of {@code packageName} was paused or stopped. */
    void onPaused(String packageName, long timestamp) {
        if (packageName != null && packageName.equals(current)) {
            end(timestamp);
        }
    }

    /** Screen off, keyguard shown or device shutdown: nothing is in the foreground any more. */
    void onScreenGone(long timestamp) {
        end(timestamp);
    }

    List<DayUsage> result() {
        List<DayUsage> days = new ArrayList<>();
        for (Map.Entry<String, Long> total : totals.entrySet()) {
            long minutes = total.getValue() / 60_000L;
            if (minutes <= 0) {
                continue;
            }
            int separator = total.getKey().indexOf('|');
            days.add(new DayUsage(total.getKey().substring(0, separator), total.getKey().substring(separator + 1),
                    minutes));
        }
        return days;
    }

    private void end(long timestamp) {
        if (current == null) {
            return;
        }
        String packageName = current;
        long start = since;
        current = null;
        if (timestamp - start > MAX_SESSION_MS || !packages.contains(packageName)) {
            return;
        }
        add(packageName, start, timestamp);
    }

    private void add(String packageName, long start, long end) {
        long from = Math.max(start, rangeStart);
        long to = Math.min(end, rangeEnd);
        while (from < to) {
            Calendar day = startOfDay(from);
            String key = format(day) + "|" + packageName;
            day.add(Calendar.DAY_OF_MONTH, 1);
            long chunkEnd = Math.min(to, day.getTimeInMillis());
            Long previous = totals.get(key);
            totals.put(key, (previous == null ? 0L : previous) + (chunkEnd - from));
            from = chunkEnd;
        }
    }

    private Calendar startOfDay(long timestamp) {
        Calendar calendar = Calendar.getInstance(zone, Locale.ROOT);
        calendar.setTimeInMillis(timestamp);
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        return calendar;
    }

    private static String format(Calendar day) {
        return String.format(Locale.ROOT, "%04d-%02d-%02d",
                day.get(Calendar.YEAR), day.get(Calendar.MONTH) + 1, day.get(Calendar.DAY_OF_MONTH));
    }

    /** Start (inclusive) of the local day {@code yyyy-MM-dd} in {@code zone}; -1 when malformed. */
    static long parseDayStart(String date, TimeZone zone) {
        if (date == null || !date.matches("\\d{4}-\\d{2}-\\d{2}")) {
            return -1;
        }
        Calendar calendar = Calendar.getInstance(zone, Locale.ROOT);
        calendar.clear();
        calendar.setLenient(false);
        try {
            calendar.set(Integer.parseInt(date.substring(0, 4)), Integer.parseInt(date.substring(5, 7)) - 1,
                    Integer.parseInt(date.substring(8, 10)));
            return calendar.getTimeInMillis();
        } catch (IllegalArgumentException e) {
            return -1;
        }
    }
}
