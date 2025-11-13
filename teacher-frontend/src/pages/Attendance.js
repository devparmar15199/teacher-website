import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useLocation } from 'react-router-dom';
import { classService } from '../services/classService';
import { attendanceService } from '../services/attendanceService';
import QRCode from 'react-qr-code';
import { toast } from 'react-hot-toast';
import { useModal } from '../hooks/useModal';
import AlertModal from '../components/common/AlertModal';
import ConfirmModal from '../components/common/ConfirmModal';

const Attendance = () => {
  const [activeTab, setActiveTab] = useState('qr'); // 'qr' or 'manual'
  const [selectedClass, setSelectedClass] = useState('');
  const [qrDuration, setQrDuration] = useState(10);
  const [activeSession, setActiveSession] = useState(null);
  const [currentQRData, setCurrentQRData] = useState(null);
  const [tokenCountdown, setTokenCountdown] = useState(15);
  const [sessionCountdown, setSessionCountdown] = useState(0);
  
  // Manual attendance states
  const [manualSelectedClass, setManualSelectedClass] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [manualNotes, setManualNotes] = useState('');
  const [showDebugView, setShowDebugView] = useState(false);
  
  const queryClient = useQueryClient();
  const location = useLocation();
  const tokenRefreshInterval = useRef(null);
  const tokenCountdownInterval = useRef(null);
  const sessionCountdownInterval = useRef(null);
  const { alertModal, confirmModal, showAlert, showConfirm, closeAlert, closeConfirm } = useModal();

  // Extract classId from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const classId = urlParams.get('classId');
    if (classId) {
      setSelectedClass(classId);
    }
  }, [location.search]);

  // Clear intervals on unmount
  useEffect(() => {
    return () => {
      if (tokenRefreshInterval.current) clearInterval(tokenRefreshInterval.current);
      if (tokenCountdownInterval.current) clearInterval(tokenCountdownInterval.current);
      if (sessionCountdownInterval.current) clearInterval(sessionCountdownInterval.current);
    };
  }, []);

  // Setup token refresh when session becomes active
  useEffect(() => {
    if (activeSession && activeSession.sessionId) {
      startTokenRefresh();
      startSessionCountdown();
    } else {
      stopAllTimers();
    }

    return () => stopAllTimers();
  }, [activeSession]);

  const startTokenRefresh = () => {
    // Clear existing intervals
    stopAllTimers();

    console.log('Starting token refresh mechanism');

    // Start token countdown
    setTokenCountdown(15);
    tokenCountdownInterval.current = setInterval(() => {
      setTokenCountdown(prev => {
        const newValue = prev - 1;
        
        if (newValue <= 0) {
          // Time to refresh token
          console.log('Token countdown reached 0, refreshing...');
          refreshToken();
          return 15; // Reset countdown for next cycle
        }
        
        return newValue;
      });
    }, 1000);
  };

  const startSessionCountdown = () => {
    if (!activeSession?.sessionExpiresAt) {
      console.log('No session expiration time available, activeSession:', activeSession);
      return;
    }
    
    console.log('Starting session countdown until:', activeSession.sessionExpiresAt);
    console.log('Current time:', new Date().toISOString());
    console.log('Session expires at (parsed):', new Date(activeSession.sessionExpiresAt).toISOString());
    console.log('Time difference in minutes:', (new Date(activeSession.sessionExpiresAt).getTime() - new Date().getTime()) / (1000 * 60));
    
    sessionCountdownInterval.current = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(activeSession.sessionExpiresAt).getTime();
      const difference = expiry - now;

      console.log('Timer calculation:', {
        now: new Date(now).toISOString(),
        expiry: new Date(expiry).toISOString(),
        difference: difference,
        secondsLeft: Math.floor(difference / 1000),
        minutesLeft: Math.floor(difference / (1000 * 60))
      });

      if (difference > 0) {
        const secondsLeft = Math.floor(difference / 1000);
        setSessionCountdown(secondsLeft);
        
        // Warn when session is about to expire
        if (secondsLeft <= 60 && secondsLeft % 15 === 0) {
          toast.warning(`Session expires in ${secondsLeft} seconds`);
        }
      } else {
        console.log('Session has expired, clearing session');
        setSessionCountdown(0);
        // Session expired, clean up
        setActiveSession(null);
        setCurrentQRData(null);
        stopAllTimers();
        toast.error('QR session has expired');
      }
    }, 1000);
  };

  const stopAllTimers = () => {
    if (tokenRefreshInterval.current) {
      clearInterval(tokenRefreshInterval.current);
      tokenRefreshInterval.current = null;
    }
    if (tokenCountdownInterval.current) {
      clearInterval(tokenCountdownInterval.current);
      tokenCountdownInterval.current = null;
    }
    if (sessionCountdownInterval.current) {
      clearInterval(sessionCountdownInterval.current);
      sessionCountdownInterval.current = null;
    }
  };

  const refreshToken = async () => {
    if (!activeSession?.sessionId) {
      console.log('No active session for token refresh, activeSession:', activeSession);
      return;
    }

    try {
      console.log('Refreshing token for session:', activeSession.sessionId);
      const response = await attendanceService.refreshQRToken(activeSession.sessionId);
      
      console.log('Refresh response:', response);
      console.log('Response structure:', {
        success: response.success,
        hasQrPayload: !!response.qrPayload,
        qrPayload: response.qrPayload,
        sessionId: response.sessionId
      });
      
      if (response.success && response.qrPayload) {
        setCurrentQRData(response.qrPayload);
        console.log('Token refreshed successfully, new QR data set');
        
        // Reset the countdown after successful refresh
        setTokenCountdown(15);
      } else {
        console.error('Refresh failed - no QR payload in response', response);
        // Don't clear the session on refresh failure, just retry next cycle
        console.warn('Token refresh failed, will retry in next cycle');
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      if (error.response?.status === 404) {
        // Session no longer exists
        console.log('Session not found (404), clearing session');
        setActiveSession(null);
        setCurrentQRData(null);
        stopAllTimers();
        toast.error('QR session has ended');
      } else {
        // Other errors - keep trying but show warning
        console.warn('Token refresh failed, will retry in next cycle');
        toast.error('Failed to refresh QR code');
      }
    }
  };

  // Fetch classes
  const { data: classes, isLoading: classesLoading } = useQuery(
    'classes',
    classService.getClasses
  );

  // Fetch students for selected class (for manual attendance)
  const { data: studentsData, isLoading: studentsLoading } = useQuery(
    ['students', manualSelectedClass],
    () => attendanceService.getStudentsForClass(manualSelectedClass),
    {
      enabled: !!manualSelectedClass && activeTab === 'manual',
      onError: (error) => {
        console.error('Error fetching students:', error);
        showAlert('Failed to fetch students for this class', 'error');
      }
    }
  );

  // Fetch all students (for debugging)
  const { data: allStudentsData, isLoading: allStudentsLoading } = useQuery(
    'all-students',
    attendanceService.getAllStudents,
    {
      enabled: showDebugView && activeTab === 'manual'
    }
  );

  // Bulk enroll mutation
  const bulkEnrollMutation = useMutation(
    ({ classId, studentEmails }) => attendanceService.bulkEnrollStudents(classId, studentEmails),
    {
      onSuccess: (data) => {
        console.log('Bulk enrollment successful:', data);
        showAlert(`Successfully enrolled ${data.data.successCount} students!`, 'success');
        queryClient.invalidateQueries(['students', manualSelectedClass]);
        setShowDebugView(false);
      },
      onError: (error) => {
        console.error('Error with bulk enrollment:', error);
        const errorMessage = error?.response?.data?.message || 'Failed to enroll students';
        showAlert(`Error: ${errorMessage}`, 'error');
      }
    }
  );

  // Fetch active QR sessions
  const { data: activeSessionsData } = useQuery(
    'activeQRSessions',
    attendanceService.getActiveQRSessions,
    {
      refetchInterval: 30000, // Check every 30 seconds for session status
      onSuccess: (data) => {
        console.log('Active sessions query success, data:', data);
        console.log('Data structure:', {
          success: data.success,
          hasSessions: !!data.sessions,
          sessionsLength: data.sessions?.length,
          sessions: data.sessions
        });
        
        if (!activeSession && data.sessions && data.sessions.length > 0) {
          const session = data.sessions[0];
          console.log('Setting active session from query:', session);
          console.log('Session fields:', {
            sessionId: session.sessionId,
            sessionExpiresAt: session.sessionExpiresAt,
            qrPayload: session.qrPayload,
            isActive: session.isActive
          });
          setActiveSession(session);
          setCurrentQRData(session.qrPayload);
          console.log('Set active session from query:', session.sessionId);
        }
        if (activeSession && (!data.sessions || data.sessions.length === 0)) {
          console.log('No active sessions found, but checking if current session is still valid');
          // Don't immediately clear the session - it might be a temporary polling issue
          // Instead, let the session expiration logic handle it
          const now = new Date().getTime();
          const expiry = new Date(activeSession.sessionExpiresAt).getTime();
          if (expiry <= now) {
            console.log('Current session has expired, clearing local session');
            setActiveSession(null);
            setCurrentQRData(null);
            stopAllTimers();
          } else {
            console.log('Current session is still valid, keeping it active');
          }
        }
      },
      onError: (error) => {
        console.error('Failed to fetch active sessions:', error);
        console.error('Error response:', error.response?.data);
      }
    }
  );

  // Generate QR Session mutation
  const generateQRMutation = useMutation(
    ({ classId, duration }) => attendanceService.generateQRSession(classId, duration),
    {
      onSuccess: (data) => {
        console.log('QR generation response:', data);
        console.log('Response data structure:', {
          sessionId: data.sessionId,
          expiresAt: data.expiresAt,
          sessionExpiresAt: data.sessionExpiresAt,
          duration: data.duration,
          qrPayload: data.qrPayload
        });
        setActiveSession(data);
        setCurrentQRData(data.qrPayload);
        queryClient.invalidateQueries('activeQRSessions');
        toast.success('QR session started with dynamic security!');
        console.log('QR Session generated successfully:', data);
      },
      onError: (error) => {
        console.error('Error generating QR:', error);
        const errorMessage = error?.response?.data?.message || 'Failed to generate QR code';
        toast.error(`Error: ${errorMessage}`);
      }
    }
  );

  // Terminate QR Session mutation
  const terminateQRMutation = useMutation(
    (sessionId) => attendanceService.terminateQRSession(sessionId),
    {
      onSuccess: () => {
        console.log('QR Session terminated successfully');
        setActiveSession(null);
        setCurrentQRData(null);
        stopAllTimers();
        queryClient.invalidateQueries('activeQRSessions');
        toast.success('QR session terminated');
      },
      onError: (error) => {
        console.error('Error terminating QR:', error);
        const errorMessage = error?.response?.data?.message || 'Failed to terminate QR session';
        toast.error(`Error: ${errorMessage}`);
      }
    }
  );

  // Terminate All QR Sessions mutation
  const terminateAllMutation = useMutation(
    () => attendanceService.terminateAllQRSessions(),
    {
      onSuccess: (data) => {
        console.log('All QR Sessions terminated successfully:', data);
        setActiveSession(null);
        setCurrentQRData(null);
        stopAllTimers();
        queryClient.invalidateQueries('activeQRSessions');
        showAlert('All QR sessions cleared', 'success');
      },
      onError: (error) => {
        console.error('Error terminating all QR sessions:', error);
        const errorMessage = error?.response?.data?.message || 'Failed to terminate all QR sessions';
        showAlert(`Error: ${errorMessage}`, 'error');
      }
    }
  );

  // Manual Attendance mutation
  const manualAttendanceMutation = useMutation(
    attendanceService.markManualAttendance,
    {
      onSuccess: (data) => {
        console.log('Manual attendance marked successfully:', data);
        console.log('Response details:', {
          success: data.success,
          message: data.message,
          successCount: data.data?.successCount,
          errorCount: data.data?.errorCount,
          failed: data.data?.failed
        });
        
        if (data.data?.failed && data.data.failed.length > 0) {
          console.warn('Some students failed:', data.data.failed);
          const failedMessages = data.data.failed.map(f => `${f.studentId}: ${f.error}`).join('\n');
          showAlert(`Partial success: ${data.data.successCount} marked, ${data.data.errorCount} failed\n\nFailed students:\n${failedMessages}`, 'warning');
        } else {
          showAlert('Manual attendance marked successfully!', 'success');
        }
        
        setSelectedStudents([]);
        setManualNotes('');
        queryClient.invalidateQueries(['students', manualSelectedClass]);
      },
      onError: (error) => {
        console.error('Error marking manual attendance:', error);
        console.error('Error response:', error?.response?.data);
        const errorMessage = error?.response?.data?.message || 'Failed to mark manual attendance';
        const errorDetails = error?.response?.data?.data?.failed || [];
        
        let detailedMessage = `Error: ${errorMessage}`;
        if (errorDetails.length > 0) {
          const failedMessages = errorDetails.map(f => `${f.studentId}: ${f.error}`).join('\n');
          detailedMessage += `\n\nFailed students:\n${failedMessages}`;
        }
        
        showAlert(detailedMessage, 'error');
      }
    }
  );

  const handleGenerateQR = () => {
    if (!selectedClass) {
      showAlert('Please select a class first', 'warning');
      return;
    }
    generateQRMutation.mutate({ classId: selectedClass, duration: qrDuration });
  };

  const handleTerminateQR = () => {
    if (activeSession?.sessionId) {
      console.log('Terminating session with ID:', activeSession.sessionId);
      terminateQRMutation.mutate(activeSession.sessionId);
    } else {
      showAlert('No active session to terminate', 'warning');
    }
  };

  const handleTerminateAll = () => {
    showConfirm(
      'Are you sure you want to terminate all active QR sessions? This action cannot be undone.',
      () => terminateAllMutation.mutate(),
      {
        title: 'Terminate All Sessions',
        type: 'danger',
        confirmText: 'Terminate All',
        cancelText: 'Cancel'
      }
    );
  };

  const handleManualAttendance = () => {
    console.log('handleManualAttendance function called!');
    console.log('manualSelectedClass:', manualSelectedClass);
    console.log('selectedStudents:', selectedStudents);
    
    if (!manualSelectedClass) {
      console.log('No class selected, showing alert');
      showAlert('Please select a class first', 'warning');
      return;
    }
    if (selectedStudents.length === 0) {
      console.log('No students selected, showing alert');
      showAlert('Please select at least one student', 'warning');
      return;
    }

    const studentCount = selectedStudents.length;
    const studentText = studentCount === 1 ? 'student' : 'students';
    
    console.log('Manual attendance data:', {
      studentIds: selectedStudents,
      classId: manualSelectedClass,
      notes: manualNotes || 'Manual attendance entry by teacher'
    });
    
    console.log('About to show confirmation modal');
    showConfirm(
      `Mark attendance for ${studentCount} ${studentText}?`,
      () => {
        console.log('Confirmation accepted, calling mutation');
        manualAttendanceMutation.mutate({
          studentIds: selectedStudents,
          classId: manualSelectedClass,
          notes: manualNotes || 'Manual attendance entry by teacher'
        });
      },
      {
        title: 'Mark Manual Attendance',
        type: 'warning',
        confirmText: `Mark ${studentCount} ${studentText} Present`,
        cancelText: 'Cancel'
      }
    );
    console.log('showConfirm called');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const classesArray = Array.isArray(classes) ? classes : [];
  const selectedClassData = classesArray.find(cls => cls._id === selectedClass);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Attendance Management</h1>
        <p className="text-gray-600">Manage attendance with QR codes or manual entry</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('qr')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'qr'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h4" />
                </svg>
                QR Code Attendance
              </div>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'manual'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Manual Attendance
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* QR Code Tab Content */}
      {activeTab === 'qr' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* QR Code Generation Panel */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Generate QR Code</h2>
            
            {/* Class Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!!activeSession}
              >
                <option value="">Choose a class...</option>
                {classesLoading ? (
                  <option disabled>Loading classes...</option>
                ) : (
                  classesArray.map((classItem) => (
                    <option key={classItem._id} value={classItem._id}>
                      {classItem.subjectCode} - {classItem.subjectName} (Year {classItem.classYear})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Duration Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Duration (minutes)
              </label>
              <select
                value={qrDuration}
                onChange={(e) => setQrDuration(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!!activeSession}
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
            </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {!activeSession ? (
              <button
                onClick={handleGenerateQR}
                disabled={!selectedClass || generateQRMutation.isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generateQRMutation.isLoading ? 'Generating...' : 'Generate Dynamic QR Code'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleTerminateQR}
                  disabled={terminateQRMutation.isLoading}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {terminateQRMutation.isLoading ? 'Terminating...' : 'Terminate QR Session'}
                </button>
                <button
                  onClick={() => terminateAllMutation.mutate()}
                  disabled={terminateAllMutation.isLoading}
                  className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm disabled:opacity-50"
                >
                  {terminateAllMutation.isLoading ? 'Clearing...' : 'Force Clear All Sessions'}
                </button>
              </>
            )}
          </div>

          {/* Security Info */}
          {activeSession && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-medium text-green-900 mb-2">🔒 Security Features Active</h3>
              <div className="text-sm text-green-700 space-y-1">
                <p>✓ QR code changes every 15 seconds</p>
                <p>✓ Prevents photo sharing</p>
                <p>✓ Session-based validation</p>
              </div>
            </div>
          )}

          {/* Class Information */}
          {selectedClassData && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Selected Class Details</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">Subject:</span> {selectedClassData.subjectCode} - {selectedClassData.subjectName}</p>
                <p><span className="font-medium">Year:</span> {selectedClassData.classYear}</p>
                <p><span className="font-medium">Semester:</span> {selectedClassData.semester}</p>
                <p><span className="font-medium">Division:</span> {selectedClassData.division}</p>
              </div>
            </div>
          )}
        </div>

        {/* QR Code Display Panel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Dynamic QR Code</h2>
          
          {activeSession && currentQRData ? (
            <div className="text-center">
              {/* Token Refresh Indicator */}
              <div className="mb-4 flex justify-center">
                <div className={`px-4 py-2 rounded-full transition-colors ${
                  tokenCountdown <= 5 ? 'bg-orange-100 border border-orange-300' : 'bg-blue-100 border border-blue-300'
                }`}>
                  <span className={`text-sm font-medium ${
                    tokenCountdown <= 5 ? 'text-orange-800' : 'text-blue-800'
                  }`}>
                    {tokenCountdown <= 5 ? '🔄 Refreshing in: ' : 'Next refresh in: '}
                    <span className="font-bold">{tokenCountdown}s</span>
                  </span>
                </div>
              </div>

              {/* QR Code */}
              <div className="mb-6 flex justify-center">
                <div className={`relative p-4 bg-white border-2 rounded-lg shadow-sm transition-all duration-300 ${
                  tokenCountdown <= 1 ? 'border-orange-400 shadow-orange-200' : 'border-gray-200'
                }`}>
                  <QRCode
                    value={JSON.stringify(currentQRData)}
                    size={200}
                    level="M"
                  />
                  {tokenCountdown <= 1 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 rounded-lg">
                      <div className="text-orange-600 font-medium">Updating...</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Session Info */}
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <h3 className="font-medium text-blue-900 mb-2">Active Dynamic Session</h3>
                <div className="text-sm text-blue-700 space-y-1">
                  <p><span className="font-medium">Class:</span> {currentQRData?.subjectCode} - {currentQRData?.subjectName}</p>
                  <p><span className="font-medium">Session ID:</span> {activeSession.sessionId}</p>
                  <p><span className="font-medium">Security:</span> Dynamic QR (15s refresh)</p>
                </div>
              </div>

              {/* Countdown Timer */}
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {formatTime(sessionCountdown)}
                </div>
                <p className="text-sm text-gray-500">Session time remaining</p>
              </div>

              {/* Warning for expired tokens */}
              {tokenCountdown <= 3 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 font-medium">
                    🔄 QR Code refreshing in {tokenCountdown} seconds...
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h4"></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Active QR Session</h3>
              <p className="text-gray-500">Generate a dynamic QR code to start secure attendance</p>
            </div>
          )}
        </div>

        {/* Dynamic QR Info */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">How Dynamic QR Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-blue-600 mb-2">🔄</div>
              <h3 className="font-medium text-blue-900">Continuous Refresh</h3>
              <p className="text-sm text-blue-700">QR code updates every 15 seconds until session ends</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-green-600 mb-2">🛡️</div>
              <h3 className="font-medium text-green-900">Proxy Prevention</h3>
              <p className="text-sm text-green-700">Photos become invalid quickly, preventing sharing</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-purple-600 mb-2">✅</div>
              <h3 className="font-medium text-purple-900">Session-Based</h3>
              <p className="text-sm text-purple-700">Each session has unique ID and rotating tokens</p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Manual Attendance Tab Content */}
      {activeTab === 'manual' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Manual Attendance Entry</h2>
          <p className="text-gray-600 mb-6">Mark attendance manually when QR system is not available</p>

          {/* Class Selection for Manual */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Class
            </label>
            <select
              value={manualSelectedClass}
              onChange={(e) => setManualSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a class...</option>
              {classesLoading ? (
                <option disabled>Loading classes...</option>
              ) : (
                classesArray.map((classItem) => (
                  <option key={classItem._id} value={classItem._id}>
                    {classItem.subjectCode} - {classItem.subjectName} (Year {classItem.classYear})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Debug Helper */}
          {manualSelectedClass && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-yellow-900">Student Enrollment Helper</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDebugView(!showDebugView)}
                    className="text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
                  >
                    {showDebugView ? 'Hide' : 'Show'} All Students
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/teacher/attendance/debug/class/${manualSelectedClass}`, {
                          headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            'Content-Type': 'application/json'
                          }
                        });
                        const data = await response.json();
                        console.log('Debug data:', data);
                        alert('Debug data logged to console. Check F12 -> Console tab.');
                      } catch (error) {
                        console.error('Debug error:', error);
                        alert('Debug failed: ' + error.message);
                      }
                    }}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Debug Class Data
                  </button>
                </div>
              </div>
              
              {showDebugView && (
                <div className="space-y-3">
                  <p className="text-sm text-yellow-800">
                    If you don't see students below, they might not be enrolled in this class yet. 
                    Here are all students in the system:
                  </p>
                  
                  {allStudentsLoading ? (
                    <div className="text-sm text-yellow-700">Loading all students...</div>
                  ) : allStudentsData?.data && allStudentsData.data.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-2 bg-white">
                        {allStudentsData.data.map((student) => (
                          <div key={student._id} className="text-xs p-2 border rounded bg-gray-50">
                            <div className="font-medium">{student.name || student.fullName}</div>
                            <div className="text-gray-600">{student.email}</div>
                            {student.enrollmentNo && (
                              <div className="text-gray-500">ID: {student.enrollmentNo}</div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <button
                        onClick={() => {
                          const emails = allStudentsData.data.map(student => student.email);
                          bulkEnrollMutation.mutate({
                            classId: manualSelectedClass,
                            studentEmails: emails
                          });
                        }}
                        disabled={bulkEnrollMutation.isLoading}
                        className="w-full bg-yellow-600 text-white py-2 px-4 rounded hover:bg-yellow-700 disabled:opacity-50 text-sm"
                      >
                        {bulkEnrollMutation.isLoading 
                          ? 'Enrolling...' 
                          : `Enroll All ${allStudentsData.data.length} Students in This Class`}
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-yellow-700">No students found in the system</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Students Selection */}
          {manualSelectedClass && !studentsLoading && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Select Students to Mark Present</h3>
              
              {studentsData?.data && studentsData.data.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {/* Select All Checkbox */}
                  <div className="flex items-center pb-3 border-b border-gray-200">
                    <input
                      type="checkbox"
                      id="select-all"
                      checked={selectedStudents.length === studentsData.data.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudents(studentsData.data.map(student => student._id));
                        } else {
                          setSelectedStudents([]);
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="select-all" className="ml-2 text-sm font-medium text-gray-900">
                      Select All Students ({studentsData.data.length})
                    </label>
                  </div>

                  {/* Individual Student Checkboxes */}
                  {studentsData.data.map((student) => (
                    <div key={student._id} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`student-${student._id}`}
                        checked={selectedStudents.includes(student._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudents([...selectedStudents, student._id]);
                          } else {
                            setSelectedStudents(selectedStudents.filter(id => id !== student._id));
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`student-${student._id}`} className="ml-2 text-sm text-gray-700">
                        {student.name} - {student.enrollmentNo || student.rollNumber}
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {studentsLoading ? 'Loading students...' : 'No students enrolled in this class'}
                </div>
              )}
            </div>
          )}

          {/* Notes Field */}
          {manualSelectedClass && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="Add any notes about this manual attendance entry..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Submit Button */}
          {manualSelectedClass && selectedStudents.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={handleManualAttendance}
                disabled={manualAttendanceMutation.isLoading}
                className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {manualAttendanceMutation.isLoading 
                  ? 'Marking Attendance...' 
                  : `Mark ${selectedStudents.length} Student${selectedStudents.length !== 1 ? 's' : ''} Present`}
              </button>
            </div>
          )}

          {/* Manual Attendance Info */}
          <div className="mt-8 bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Manual Attendance Guidelines</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-start">
                  <div className="text-blue-600 mr-2">📝</div>
                  <div>
                    <h4 className="font-medium text-gray-900">When to Use</h4>
                    <p className="text-sm text-gray-600">Use when QR system is unavailable or technical issues occur</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="text-green-600 mr-2">✅</div>
                  <div>
                    <h4 className="font-medium text-gray-900">Verification</h4>
                    <p className="text-sm text-gray-600">Verify student presence before marking attendance</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-start">
                  <div className="text-orange-600 mr-2">📋</div>
                  <div>
                    <h4 className="font-medium text-gray-900">Record Keeping</h4>
                    <p className="text-sm text-gray-600">Manual entries are logged with timestamps and notes</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="text-purple-600 mr-2">🔒</div>
                  <div>
                    <h4 className="font-medium text-gray-900">Security</h4>
                    <p className="text-sm text-gray-600">All manual entries are audited and traceable</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modals */}
      <AlertModal 
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={closeAlert}
      />
      
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        onConfirm={() => {
          if (confirmModal.onConfirm) {
            confirmModal.onConfirm();
          }
        }}
        onClose={closeConfirm}
      />
    </div>
  );
};

export default Attendance;