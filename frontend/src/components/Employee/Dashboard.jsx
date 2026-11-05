import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Row, Spinner } from 'react-bootstrap';
import { FaClock, FaCalendarCheck, FaUmbrellaBeach, FaSyncAlt } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useMobileDevice } from '../../hooks/useMobileDevice';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { getSharedEmployeeProfile } from '../../utils/sharedEmployeeProfile';
import ProfileCompletion from './ProfileCompletion';
import BreakWidget from '../Common/BreakWidget';
import './EmployeeDashboard.css';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const employeeId = user?.employeeId;
  const isMobileDevice = useMobileDevice();
  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [attendanceCounts, setAttendanceCounts] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveBalanceError, setLeaveBalanceError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [clockLoading, setClockLoading] = useState(false);
  const [networkBlocked, setNetworkBlocked] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);
  const [clockOutPreview, setClockOutPreview] = useState(null);

  const storageKey = `attendance_session_${employeeId}`;
  const saveSession = useCallback(
    (session) => localStorage.setItem(storageKey, JSON.stringify(session)),
    [storageKey]
  );
  const clearSession = useCallback(() => localStorage.removeItem(storageKey), [storageKey]);

  const formatAttendanceTime = (value) => {
    if (!value) return '--:--';
    const text = String(value);
    if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(text)) {
      const date = new Date(text);
      return Number.isNaN(date.getTime())
        ? '--:--'
        : date.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata',
        });
    }

    const timePart = text.replace('T', ' ').split(' ')[1];
    if (!timePart) return '--:--';
    const [hour, minute] = timePart.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return '--:--';
    const period = hour >= 12 ? 'PM' : 'AM';
    return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
  };

  const fetchEmployee = useCallback(async () => {
    const response = await getSharedEmployeeProfile(employeeId);
    setEmployee(response.data);
  }, [employeeId]);

  const fetchLeaveBalance = useCallback(async () => {
    setLeaveBalanceError('');
    try {
      const response = await axios.get(API_ENDPOINTS.LEAVE_BALANCE(employeeId));
      setLeaveBalance({
        available: Number(response.data.available) || 0,
        totalAccrued: Number(response.data.total_accrued) || 0,
      });
    } catch (fetchError) {
      console.error('Error fetching leave balance:', fetchError);
      setLeaveBalanceError('Unable to load leave balance.');
    }
  }, [employeeId]);

  const fetchAttendanceCount = useCallback(async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_EMPLOYEE_COUNT(employeeId));
      setAttendanceCounts({
        present: Number(response.data.counts?.present) || 0,
        absent: Number(response.data.counts?.absent) || 0,
        onLeave: Number(response.data.counts?.on_leave) || 0,
        halfDay: Number(response.data.counts?.half_day) || 0,
      });
    } catch (fetchError) {
      console.error('Error fetching attendance count:', fetchError);
      setError('Unable to load your attendance summary.');
    }
  }, [employeeId]);

  const fetchTodayAttendance = useCallback(async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(employeeId));
      const data = response.data.attendance;
      const serverSession = response.data.active_session;
      if (data) {
        data.clock_in = data.clock_in_ist || data.clock_in;
        data.clock_out = data.clock_out_ist || data.clock_out;
      }
      setAttendance(data || null);

      if (serverSession) {
        setActiveSession(serverSession);
        saveSession(serverSession);
      } else if (data?.clock_in && !data.clock_out) {
        setActiveSession({ session_id: data.session_id || 'inferred' });
      } else {
        setActiveSession(null);
        clearSession();
      }
    } catch (fetchError) {
      console.error('Error fetching today attendance:', fetchError);
      setError('Unable to load today’s attendance.');
    }
  }, [employeeId, saveSession, clearSession]);

  const loadDashboardData = useCallback(async () => {
    if (!employeeId) return;
    setError('');
    const results = await Promise.allSettled([
      fetchEmployee(),
      fetchLeaveBalance(),
      fetchAttendanceCount(),
      fetchTodayAttendance(),
    ]);
    if (results[0].status === 'rejected') {
      console.error('Error fetching employee profile:', results[0].reason);
      setError('Unable to load your employee profile.');
    }
  }, [employeeId, fetchEmployee, fetchLeaveBalance, fetchAttendanceCount, fetchTodayAttendance]);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    setLoading(true);
    loadDashboardData().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [employeeId, loadDashboardData]);

  useEffect(() => {
    if (user?.role !== 'housekeeper') return undefined;
    let cancelled = false;
    const checkNetwork = async () => {
      try {
        await axios.get(API_ENDPOINTS.ATTENDANCE_NETWORK_STATUS);
        if (!cancelled) setNetworkBlocked(false);
      } catch (networkError) {
        if (!cancelled) {
          setNetworkBlocked(networkError.response?.data?.code === 'IP_BLOCKED');
        }
      }
    };
    checkNetwork();
    const interval = setInterval(checkNetwork, 45000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.role]);

  const refreshData = async () => {
    setRefreshing(true);
    try {
      await loadDashboardData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleClockIn = async () => {
    setClockLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await axios.post(API_ENDPOINTS.ATTENDANCE_CLOCK_IN, {
        employee_id: employeeId,
        latitude: null,
        longitude: null,
        accuracy: null,
      });
      const clockIn = response.data.clock_in_ist || response.data.clock_in;
      setAttendance({
        clock_in: clockIn,
        clock_out: null,
        status: 'working',
        attendance_date: response.data.attendance_date,
        session_id: response.data.session_id,
      });
      const session = { session_id: response.data.session_id, clock_in_time: clockIn };
      setActiveSession(session);
      saveSession(session);
      setMessage({ type: 'success', text: response.data.message || 'Clocked in successfully!' });
      await Promise.all([fetchTodayAttendance(), fetchAttendanceCount()]);
    } catch (clockError) {
      if (clockError.response?.data?.code === 'IP_BLOCKED') setNetworkBlocked(true);
      setMessage({ type: 'danger', text: clockError.response?.data?.message || 'Failed to clock in.' });
    } finally {
      setClockLoading(false);
    }
  };

  const handleClockOut = async () => {
    setClockLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const attendanceResponse = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(employeeId));
      const serverSession = attendanceResponse.data.active_session;
      if (!serverSession) {
        await fetchTodayAttendance();
        return;
      }
      const response = await axios.post(API_ENDPOINTS.ATTENDANCE_CLOCK_OUT, {
        employee_id: employeeId,
        session_id: serverSession.session_id,
        latitude: null,
        longitude: null,
        accuracy: null,
      });
      setMessage({ type: 'success', text: response.data.message || 'Clocked out successfully!' });
      await Promise.all([fetchTodayAttendance(), fetchAttendanceCount()]);
    } catch (clockError) {
      if (clockError.response?.data?.code === 'IP_BLOCKED') setNetworkBlocked(true);
      setMessage({
        type: clockError.response?.data?.code === 'MINIMUM_CLOCK_OUT_TIME' ? 'warning' : 'danger',
        text: clockError.response?.data?.message || 'Failed to clock out.',
      });
    } finally {
      setClockLoading(false);
    }
  };

  const openClockOutConfirm = async () => {
    setShowClockOutConfirm(true);
    setClockOutPreview(null);
    try {
      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_CLOCK_OUT_PREVIEW(employeeId));
      setClockOutPreview(response.data);
    } catch (previewError) {
      console.error('Error checking clock-out preview:', previewError);
      setClockOutPreview({ is_clocked_in: false });
    }
  };

  if (loading) {
    return (
      <div className="employee-dashboard-loading">
        <Spinner animation="border" variant="primary" />
        <span>Loading your dashboard…</span>
      </div>
    );
  }

  if (
    employee?.require_profile_completion === true &&
    employee.profile_completed !== true &&
    ['employee', 'manager'].includes(user?.role)
  ) {
    const skipKey = `profile_skip_until_${employee.employee_id}`;
    if (Date.now() >= parseInt(localStorage.getItem(skipKey) || '0', 10)) {
      return (
        <ProfileCompletion
          employee={employee}
          onSkip={() => {
            localStorage.setItem(skipKey, String(Date.now() + 10 * 60 * 1000));
            window.location.reload();
          }}
        />
      );
    }
  }

  const todayLabel = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());
  const isClockedIn = !!activeSession || (!!attendance?.clock_in && !attendance?.clock_out);
  const isClockedOut = !!attendance?.clock_out && !activeSession;
  const willBeHalfDay = Boolean(
    clockOutPreview?.is_clocked_in &&
    clockOutPreview.status_if_clocked_out_now !== 'present'
  );
  const canUseClock = !networkBlocked && (user?.role === 'housekeeper' || !isMobileDevice);

  return (
    <main className="hrms-employee-dashboard employee-dashboard-minimal">
      <header className="employee-portal-header">
        <div>
          <div className="employee-portal-eyebrow">Employee Portal</div>
          <h1>{employee?.first_name ? `Welcome, ${employee.first_name}` : 'Welcome'}</h1>
          <p>{todayLabel}</p>
        </div>
        <Button
          variant="light"
          className="employee-dashboard-refresh"
          onClick={refreshData}
          disabled={refreshing}
          aria-label="Refresh dashboard"
        >
          <FaSyncAlt className={refreshing ? 'employee-dashboard-spinning' : ''} />
          <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
        </Button>
      </header>

      {error && <Alert variant="warning" className="mb-3">{error}</Alert>}
      {message.text && (
        <Alert
          variant={message.type}
          dismissible
          onClose={() => setMessage({ type: '', text: '' })}
          className="mb-3"
        >
          {message.text}
        </Alert>
      )}
      {networkBlocked && (
        <Alert variant="warning" className="mb-3">
          Connect to company Wi-Fi to use attendance clock-in and clock-out.
        </Alert>
      )}
      <Row className="g-3">
        <Col xs={12} lg={7}>
          <Card className="employee-dashboard-card mb-3">
            <Card.Body>
              <div className="employee-dashboard-card-heading">
                <div className="employee-dashboard-icon time-icon"><FaClock /></div>
                <div>
                  <h2>Time Today</h2>
                  <p>{todayLabel}</p>
                </div>
              </div>

              <div className="employee-clock-times">
                <div>
                  <span>Clock in</span>
                  <strong>{formatAttendanceTime(attendance?.clock_in_ist || attendance?.clock_in)}</strong>
                </div>
                <div>
                  <span>Clock out</span>
                  <strong>{formatAttendanceTime(attendance?.clock_out_ist || attendance?.clock_out)}</strong>
                </div>
              </div>

              <div className="employee-time-actions">
                {canUseClock ? (
                  <>
                    <Button
                      variant="primary"
                      onClick={handleClockIn}
                      disabled={clockLoading || isClockedIn}
                    >
                      {clockLoading && !isClockedIn ? <Spinner size="sm" /> : 'Clock in'}
                    </Button>
                    <Button
                      variant="outline-primary"
                      onClick={openClockOutConfirm}
                      disabled={clockLoading || !isClockedIn}
                    >
                      {clockLoading && isClockedIn ? <Spinner size="sm" /> : 'Clock out'}
                    </Button>
                  </>
                ) : (
                  <span className="employee-clock-note">
                    {networkBlocked
                      ? 'Connect to company Wi-Fi to clock in or out.'
                      : 'Clock in and out are available from a desktop device.'}
                  </span>
                )}
                <BreakWidget
                  mode="inline-button"
                  isClockedIn={isClockedIn}
                  isClockedOut={isClockedOut}
                  unlimitedBreaks={(employee?.department || '').trim().toLowerCase() === 'sales'}
                />
              </div>
            </Card.Body>
          </Card>

          <Card className="employee-dashboard-card">
            <Card.Body>
              <div className="employee-dashboard-card-heading">
                <div className="employee-dashboard-icon time-icon"><FaCalendarCheck /></div>
                <div>
                  <h2>Attendance Summary</h2>
                  <p>Your attendance this month</p>
                </div>
              </div>
              <div className="employee-attendance-count-grid">
                {[
                  { label: 'Present', value: attendanceCounts?.present },
                  { label: 'Absent', value: attendanceCounts?.absent },
                  { label: 'On leave', value: attendanceCounts?.onLeave },
                  { label: 'Half day', value: attendanceCounts?.halfDay },
                ].map(({ label, value }) => (
                  <div className="employee-attendance-count" key={label}>
                    <span><FaCalendarCheck /> {label}</span>
                    <strong>{value === undefined ? '—' : value}</strong>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} lg={5}>
          <Card className="employee-dashboard-card employee-leave-card h-100">
            <Card.Body>
              <div className="employee-dashboard-card-heading">
                <div className="employee-dashboard-icon leave-icon"><FaUmbrellaBeach /></div>
                <div>
                  <h2>Leave Balance</h2>
                  <p>Your available leave</p>
                </div>
              </div>
              {leaveBalanceError ? (
                <div className="employee-leave-error">
                  <span>{leaveBalanceError}</span>
                  <Button variant="link" onClick={fetchLeaveBalance}>Retry</Button>
                </div>
              ) : (
                <div className="employee-leave-balance">
                  <strong>{leaveBalance ? leaveBalance.available : '—'}</strong>
                  <span>days available</span>
                  {leaveBalance?.totalAccrued > 0 && (
                    <small>of {leaveBalance.totalAccrued} accrued</small>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {showClockOutConfirm && (
        <div className="employee-clockout-overlay">
          <div className="employee-clockout-dialog">
            {clockOutPreview === null ? (
              <>
                <Spinner animation="border" variant="warning" />
                <p>Checking your hours worked…</p>
              </>
            ) : (
              <>
                <h2>{willBeHalfDay ? 'Shift not complete yet' : 'Clock out?'}</h2>
                <p>
                  {willBeHalfDay
                    ? <>You have worked <strong>{clockOutPreview.total_hours_display}</strong>. Clocking out now will mark this as a half day.</>
                    : 'Are you sure you want to clock out?'}
                </p>
                <div className="employee-clockout-actions">
                  <Button variant="secondary" onClick={() => setShowClockOutConfirm(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant={willBeHalfDay ? 'warning' : 'primary'}
                    onClick={() => {
                      setShowClockOutConfirm(false);
                      handleClockOut();
                    }}
                  >
                    {willBeHalfDay ? 'Clock out anyway' : 'Clock out'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
};

export default EmployeeDashboard;
