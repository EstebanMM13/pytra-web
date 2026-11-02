package com.estebanmm13.pytra;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.TimeZone;
import org.junit.Test;

public class DailyUsageCalculatorTest {

    private static final TimeZone MADRID = TimeZone.getTimeZone("Europe/Madrid");
    private static final String GAME = "com.example.game";
    private static final String CHAT = "com.whatsapp";
    private static final String LAUNCHER = "com.android.launcher";
    private static final long MINUTE = 60_000L;
    private static final long HOUR = 60 * MINUTE;
    /** 2026-11-01 00:00 in Madrid (UTC+1). */
    private static final long NOV_1 = DailyUsageCalculator.parseDayStart("2026-11-01", MADRID);
    private static final long NOV_4 = DailyUsageCalculator.parseDayStart("2026-11-04", MADRID);

    private DailyUsageCalculator calculator() {
        return new DailyUsageCalculator(MADRID, NOV_1, NOV_4, new HashSet<>(Arrays.asList(GAME)));
    }

    @Test
    public void parseDayStartUsesTheZonesMidnight() {
        assertEquals(1_793_487_600_000L, NOV_1); // 2026-10-31T23:00:00Z
        assertEquals(-1, DailyUsageCalculator.parseDayStart("2026-13-01", MADRID));
        assertEquals(-1, DailyUsageCalculator.parseDayStart("01/11/2026", MADRID));
    }

    @Test
    public void sumsTheSessionsOfADay() {
        DailyUsageCalculator calculator = calculator();
        calculator.onResumed(GAME, NOV_1 + 10 * HOUR);
        calculator.onPaused(GAME, NOV_1 + 10 * HOUR + 30 * MINUTE);
        calculator.onResumed(GAME, NOV_1 + 20 * HOUR);
        calculator.onPaused(GAME, NOV_1 + 20 * HOUR + 45 * MINUTE + 59_999);

        List<DailyUsageCalculator.DayUsage> days = calculator.result();

        assertEquals(1, days.size());
        assertEquals("2026-11-01", days.get(0).date);
        assertEquals(GAME, days.get(0).packageName);
        assertEquals(75, days.get(0).minutes);
    }

    @Test
    public void aMissingPauseEndsWhenAnotherAppTakesTheScreenNotDaysLater() {
        // The bug reported in production: the game never logged its pause and the next one came two days later.
        DailyUsageCalculator calculator = calculator();
        calculator.onResumed(GAME, NOV_1 + 10 * HOUR);
        calculator.onResumed(LAUNCHER, NOV_1 + 10 * HOUR + 40 * MINUTE);
        calculator.onResumed(CHAT, NOV_1 + 11 * HOUR);
        calculator.onPaused(CHAT, NOV_1 + 11 * HOUR + 5 * MINUTE);
        calculator.onPaused(GAME, NOV_1 + 58 * HOUR);

        List<DailyUsageCalculator.DayUsage> days = calculator.result();

        assertEquals(1, days.size());
        assertEquals("2026-11-01", days.get(0).date);
        assertEquals(40, days.get(0).minutes);
    }

    @Test
    public void screenOffLockOrShutdownEndTheSession() {
        DailyUsageCalculator calculator = calculator();
        calculator.onResumed(GAME, NOV_1 + 9 * HOUR);
        calculator.onScreenGone(NOV_1 + 9 * HOUR + 20 * MINUTE);
        // A later pause of the game (when the user unlocks and leaves it) adds nothing.
        calculator.onPaused(GAME, NOV_1 + 15 * HOUR);

        assertEquals(20, calculator.result().get(0).minutes);
    }

    @Test
    public void aSessionOverMidnightIsSplitBetweenBothDays() {
        DailyUsageCalculator calculator = calculator();
        long midnight = NOV_1 + 24 * HOUR;
        calculator.onResumed(GAME, midnight - 30 * MINUTE);
        calculator.onPaused(GAME, midnight + 20 * MINUTE);

        List<DailyUsageCalculator.DayUsage> days = calculator.result();

        assertEquals(2, days.size());
        assertEquals("2026-11-01", days.get(0).date);
        assertEquals(30, days.get(0).minutes);
        assertEquals("2026-11-02", days.get(1).date);
        assertEquals(20, days.get(1).minutes);
    }

    @Test
    public void aSessionLongerThan12HoursIsDroppedAsCorrupt() {
        DailyUsageCalculator calculator = calculator();
        calculator.onResumed(GAME, NOV_1 + HOUR);
        calculator.onPaused(GAME, NOV_1 + 14 * HOUR);

        assertTrue(calculator.result().isEmpty());
    }

    @Test
    public void playBeforeTheRangeIsClippedAndOtherAppsOrOpenSessionsAreNotCounted() {
        DailyUsageCalculator calculator = calculator();
        calculator.onResumed(GAME, NOV_1 - HOUR);
        calculator.onPaused(GAME, NOV_1 + 15 * MINUTE);
        calculator.onResumed(CHAT, NOV_1 + HOUR);
        calculator.onPaused(CHAT, NOV_1 + 2 * HOUR);
        // Moving between two activities of the game keeps one session; a stray pause of another app does nothing.
        calculator.onResumed(GAME, NOV_1 + 5 * HOUR);
        calculator.onResumed(GAME, NOV_1 + 5 * HOUR + 10 * MINUTE);
        calculator.onPaused(CHAT, NOV_1 + 5 * HOUR + 12 * MINUTE);
        calculator.onPaused(GAME, NOV_1 + 5 * HOUR + 20 * MINUTE);
        // Never ended: dropped.
        calculator.onResumed(GAME, NOV_1 + 7 * HOUR);

        List<DailyUsageCalculator.DayUsage> days = calculator.result();

        assertEquals(1, days.size());
        assertEquals(35, days.get(0).minutes);
    }

    @Test
    public void lessThanAMinuteIsNotReported() {
        DailyUsageCalculator calculator = calculator();
        calculator.onResumed(GAME, NOV_1 + MINUTE);
        calculator.onPaused(GAME, NOV_1 + MINUTE + 59_000);

        assertTrue(calculator.result().isEmpty());
    }
}
