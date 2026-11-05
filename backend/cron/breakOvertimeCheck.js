// backend/cron/breakOvertimeCheck.js
// Backs the "Notify Emails" feature: every 10 minutes, checks every monitored
// employee's open/just-ended breaks and emails the configured recipients when
// a break runs over its allowed duration, and again when it ends. Runs
// server-side so it keeps working whether or not anyone has the app open —
// same shape as cron/missingClockOutCheck.js.
const cron = require('node-cron');
const supabase = require('../config/supabase');
const emailService = require('../services/emailService');

// Mirrors the fixed 3-type break durations in routes/attendanceRoutes.js's
// BREAK_TYPES — keep both in sync if those minutes ever change. Sales'
// unlimited, typeless 'general' breaks have no fixed duration and are
// intentionally not monitored here.
const BREAK_TYPES = {
    tea_break_1: { label: 'Tea Break 1', minutes: 15 },
    tea_break_2: { label: 'Tea Break 2', minutes: 15 },
    lunch_break:  { label: 'Lunch Break',  minutes: 30 },
};
const MONITORED_TYPES = Object.keys(BREAK_TYPES);

const SETTINGS_ID = 1;

const getActiveSettings = async () => {
    const { data, error } = await supabase
        .from('break_notification_settings')
        .select('monitored_employee_ids, notify_emails')
        .eq('id', SETTINGS_ID)
        .maybeSingle();
    if (error) {
        console.error('[breakOvertimeCheck] failed to load settings:', error.message);
        return null;
    }
    const monitoredIds = data?.monitored_employee_ids || [];
    const notifyEmails = data?.notify_emails || [];
    // The database trigger keeps this list active-only; skip all break queries when empty.
    if (monitoredIds.length === 0 || notifyEmails.length === 0) return null;

    return { monitoredIds, notifyEmails };
};

const employeeNameMap = async (employeeIds) => {
    if (employeeIds.length === 0) return {};
    const { data, error } = await supabase.from('employees')
        .select('employee_id, first_name, last_name')
        .in('employee_id', employeeIds)
        .eq('is_active', true);
    if (error) throw error;

    const map = {};
    (data || []).forEach(employee => {
        map[employee.employee_id] = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.employee_id;
    });
    return map;
};

const checkBreakOvertimeAndNotify = async () => {
    try {
        const settings = await getActiveSettings();
        if (!settings) return { checked: 0, overtimeSent: 0, endedSent: 0 };
        const { monitoredIds, notifyEmails } = settings;
        let overtimeSent = 0, endedSent = 0;

        // ── Overtime: still-open breaks past their allowed duration, not yet notified ──
        const { data: openBreaks, error: openErr } = await supabase.from('employee_breaks')
            .select('id, employee_id, break_type, break_start')
            .in('employee_id', monitoredIds)
            .in('break_type', MONITORED_TYPES)
            .is('break_end', null)
            .is('overtime_notified_at', null);
        if (openErr) throw openErr;

        // ── Ended: breaks that finished but haven't had their "ended" email sent ──
        const { data: endedBreaks, error: endedErr } = await supabase.from('employee_breaks')
            .select('id, employee_id, break_type, break_start, break_end, break_duration_minutes')
            .in('employee_id', monitoredIds)
            .in('break_type', MONITORED_TYPES)
            .not('break_end', 'is', null)
            .is('ended_notified_at', null);
        if (endedErr) throw endedErr;

        const pendingEmployeeIds = [...new Set([
            ...(openBreaks || []).map(breakRecord => breakRecord.employee_id),
            ...(endedBreaks || []).map(breakRecord => breakRecord.employee_id),
        ])];
        const nameMap = await employeeNameMap(pendingEmployeeIds);

        const now = Date.now();
        for (const b of (openBreaks || [])) {
            const spec = BREAK_TYPES[b.break_type];
            const elapsedMinutes = (now - new Date(b.break_start).getTime()) / 60000;
            if (elapsedMinutes < spec.minutes) continue;

            const result = await emailService.sendBreakOvertimeEmail(notifyEmails, {
                employeeName: nameMap[b.employee_id] || b.employee_id,
                breakTypeLabel: spec.label,
                allowedMinutes: spec.minutes,
                breakStart: b.break_start,
            });
            if (result.success) overtimeSent++;

            // Mark as notified regardless of email success — a transient Resend failure
            // shouldn't cause the same overtime alert to resend every minute forever.
            const { error: markError } = await supabase.from('employee_breaks')
                .update({ overtime_notified_at: new Date().toISOString() })
                .eq('id', b.id);
            if (markError) throw markError;
        }

        for (const b of (endedBreaks || [])) {
            const spec = BREAK_TYPES[b.break_type];
            const actualMinutes = b.break_duration_minutes ??
                Math.round((new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000);
            const overtimeMinutes = Math.max(0, actualMinutes - spec.minutes);

            const result = await emailService.sendBreakEndedEmail(notifyEmails, {
                employeeName: nameMap[b.employee_id] || b.employee_id,
                breakTypeLabel: spec.label,
                allowedMinutes: spec.minutes,
                breakStart: b.break_start,
                breakEnd: b.break_end,
                actualMinutes,
                overtimeMinutes,
            });
            if (result.success) endedSent++;

            const { error: markError } = await supabase.from('employee_breaks')
                .update({ ended_notified_at: new Date().toISOString() })
                .eq('id', b.id);
            if (markError) throw markError;
        }

        if (overtimeSent > 0 || endedSent > 0) {
            console.log(`📧 [breakOvertimeCheck] overtime: ${overtimeSent}, ended: ${endedSent}`);
        }
        return { checked: (openBreaks?.length || 0) + (endedBreaks?.length || 0), overtimeSent, endedSent };
    } catch (err) {
        console.error('[breakOvertimeCheck] unexpected error:', err.message);
        return { checked: 0, overtimeSent: 0, endedSent: 0, error: err.message };
    }
};

// Check every 10 minutes to reduce idle database traffic. Overtime alerts may be
// delayed by up to 10 minutes after a break crosses its limit.
const scheduleBreakOvertimeCheck = () => {
    cron.schedule('*/10 * * * *', async () => {
        await checkBreakOvertimeAndNotify();
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata',
    });
    console.log('📅 [breakOvertimeCheck] Cron scheduled — runs every 10 minutes');
};

module.exports = { scheduleBreakOvertimeCheck, checkBreakOvertimeAndNotify };
