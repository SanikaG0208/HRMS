import React from 'react';
import { FaSyncAlt, FaDownload } from 'react-icons/fa';
import { QA_BANNER_GRADIENT } from './quickAccessTheme';
import { getTrustedNow, getTrustedNowIST } from '../../utils/serverTime';

const QUOTES = [
  'Small daily improvements lead to stunning results.',
  'Great things are done by a series of small things brought together.',
  'Teamwork makes the dream work.',
  'Progress, not perfection.',
  'Every day is a fresh start.',
  'Success is the sum of small efforts, repeated.',
  'Collaboration is the key to unlocking great work.',
];

const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));

const greeting = (hour) => (hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening');

export default function WelcomeBanner({ name, employeeMeta = null, onRefresh, onExport, refreshing = false, headerExtra = null, belowActions = null }) {
  // Anchored to the trusted server clock, not this device's own clock/timezone — otherwise the
  // greeting and date shown here can drift from the actual India time the rest of the app uses.
  const now = getTrustedNow();
  const istHour = parseInt(getTrustedNowIST().split(' ')[1].split(':')[0], 10);
  const quote = QUOTES[dayOfYear(now) % QUOTES.length];

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: QA_BANNER_GRADIENT,
      borderRadius: 20, padding: '24px 28px', marginBottom: 20,
      minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 24, margin: 0 }}>
          {greeting(istHour)}{name ? `, ${name}` : ''}!
        </h3>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span style={{ fontStyle: 'italic' }}>"{quote}"</span>
        </div>
        {employeeMeta && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 12 }}>
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
              {employeeMeta.designation} <span style={{ opacity: 0.65 }}>•</span> {employeeMeta.department}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: 11 }}>ID: {employeeMeta.employeeId}</span>
            <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: 11 }}>{employeeMeta.employmentType}</span>
          </div>
        )}
      </div>
      {(onRefresh || onExport || headerExtra || belowActions) && (
        <div className="welcome-banner__controls">
          {headerExtra}
          {onRefresh && (
            <button onClick={onRefresh} disabled={refreshing} title="Refresh" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: refreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaSyncAlt size={12} style={{ animation: refreshing ? 'welcomeBannerSpin 0.8s linear infinite' : 'none' }} />
            </button>
          )}
          {onExport && (
            <button onClick={onExport} title="Export" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaDownload size={12} />
            </button>
          )}
          {belowActions}
        </div>
      )}
      <style>{`@keyframes welcomeBannerSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
