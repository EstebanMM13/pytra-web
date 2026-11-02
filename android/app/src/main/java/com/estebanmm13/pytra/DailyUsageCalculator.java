package com.estebanmm13.pytra;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.TreeMap;

/**
 * Foreground time per package and local day, built from the system's usage events (resumed / paused).
 *
 * <p>Each foreground interval (resumed until paused) is clipped to [rangeStart, rangeEnd) and split at the
 * local midnights of {@code zone}, so a session from 23:30 to 00:30 gives 30 minutes to each day. An interval
 * still open when the events end is dropped: while Pytra runs (and asks), no other app is in the foreground,
 * so an open interval means a missing pause event, not real play. Pure Java (no Android types) so it is
 * unit-tested on the JVM.
 */
final class DailyUsageCalculator {

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
    private final Map<String, Long> openSince = new HashMap<>();
    /** "yyyy-MM-dd|package" -> milliseconds, sorted so the result is stable. */
    private final Map<String, Long> totals = new TreeMap<>();

    DailyUsageCalculator(TimeZone zone, long rangeStart, long rangeEnd, Set<String> packages) {
        this.zone = zone;
        this.rangeStart = rangeStart;
        this.rangeEnd = rangeEnd;
        this.packages = packages;
    }

    /** Feeds one event, in time order. */
    void onEvent(String packageName, boolean foreground, long timestamp) {
        if (packageName == null || !packages.contains(packageName)) {
            return;
        }
        Long since = openSince.get(packageName);
        if (foreground) {
            if (since == null) {
                openSince.put(packageName, timestamp);
            }
        } else if (since != null) {
            openSince.remove(packageName);
            add(packageName, since, timestamp);
        }
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
