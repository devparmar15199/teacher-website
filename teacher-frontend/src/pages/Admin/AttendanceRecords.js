import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllClasses, getAttendanceRecords } from '../../services/adminService';

const AttendanceRecords = () => {
  const [classes, setClasses] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' or 'detailed'

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchAttendanceRecords();
    }
  }, [selectedClass, dateFrom, dateTo]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const response = await getAllClasses();
      setClasses(response.classes || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch classes');
      console.error('Error fetching classes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceRecords = async () => {
    if (!selectedClass) return;
    
    try {
      setLoading(true);
      const params = {};
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      
      const response = await getAttendanceRecords(selectedClass, params);
      setAttendanceRecords(response.records || []);
      setTotalSessions(response.totalSessions || 0);
      setTotalStudents(response.totalStudents || 0);
      setError('');
    } catch (err) {
      setError('Failed to fetch attendance records');
      console.error('Error fetching attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get unique years and semesters
  const years = [...new Set(classes.map(cls => cls.classYear))].filter(Boolean).sort();
  const semesters = [...new Set(classes.map(cls => cls.semester))].filter(Boolean).sort();

  // Filter classes based on selected year and semester
  const filteredClasses = classes.filter(cls => {
    if (selectedYear && cls.classYear !== selectedYear) return false;
    if (selectedSemester && cls.semester !== selectedSemester) return false;
    return true;
  });

  // Calculate attendance statistics
  const calculateStats = () => {
    if (!attendanceRecords.length) return { totalClasses: 0, averageAttendance: 0, presentCount: 0, absentCount: 0 };
    
    const totalClasses = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
    const averageAttendance = totalClasses > 0 ? ((presentCount / totalClasses) * 100).toFixed(2) : 0;
    
    return { totalClasses, averageAttendance, presentCount, absentCount };
  };

  const stats = calculateStats();

  // Filter records by search term
  const filteredRecords = attendanceRecords.filter(record => {
    const searchLower = searchTerm.toLowerCase();
    return (
      record.studentName?.toLowerCase().includes(searchLower) ||
      record.enrollmentNo?.toLowerCase().includes(searchLower)
    );
  });

  // Group records by student for summary view
  const groupByStudent = () => {
    const studentMap = {};
    
    attendanceRecords.forEach(record => {
      const studentId = record.studentId || record.enrollmentNo;
      if (!studentMap[studentId]) {
        studentMap[studentId] = {
          studentId,
          studentName: record.studentName,
          enrollmentNo: record.enrollmentNo,
          records: []
        };
      }
      studentMap[studentId].records.push(record);
    });

    return Object.values(studentMap).map(student => {
      const total = student.records.length;
      const present = student.records.filter(r => r.status === 'present').length;
      const absent = student.records.filter(r => r.status === 'absent').length;
      const percentage = total > 0 ? ((present / total) * 100).toFixed(2) : 0;
      
      return {
        ...student,
        totalClasses: total,
        present,
        absent,
        percentage
      };
    });
  };

  const studentSummary = groupByStudent();

  const getAttendanceColor = (percentage) => {
    if (percentage >= 75) return 'text-green-600 bg-green-100';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const exportToCSV = () => {
    // Helper to escape CSV values
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'string' ? v : String(v);
      // double-up quotes then wrap in quotes
      return '"' + s.replace(/"/g, '""') + '"';
    };

    // Find selected class details for metadata
    const cls = classes.find(c => c._id === selectedClass) || {};
    const subject = cls.subjectCode ? `${cls.subjectCode} - ${cls.subjectName || ''}` : (cls.subjectName || '');

    const metadata = [
      ['Exported At', new Date().toISOString()],
      ['Export Type', activeTab === 'summary' ? 'Student Summary' : 'Detailed Records'],
      ['Class', cls.classNumber || 'N/A'],
      ['Subject', subject || 'N/A'],
      ['Academic Year', cls.classYear || 'N/A'],
      ['Semester', cls.semester || 'N/A'],
      ['Date From', dateFrom || ''],
      ['Date To', dateTo || ''],
      ['Total Sessions (dates)', totalSessions || 'N/A'],
      ['Total Students', totalStudents || 'N/A'],
      ['Total Records Exported', filteredRecords.length || 0]
    ];

    let rows = [];

    if (activeTab === 'summary') {
      // Summary export: studentSummary
      const headers = ['Student Name', 'Enrollment No', 'Student ID', 'Total Classes', 'Present', 'Absent', 'Attendance %'];
      rows.push(headers);
      studentSummary.forEach(s => {
        rows.push([
          s.studentName,
          s.enrollmentNo,
          s.studentId || '',
          s.totalClasses,
          s.present,
          s.absent,
          s.percentage
        ]);
      });
    } else {
      // Detailed export: include metadata then detailed rows
      const headers = ['Date', 'Time', 'Student Name', 'Enrollment No', 'Student ID', 'Status'];
      // Add metadata as top rows (key, value)
      const csvLines = [];
      metadata.forEach(m => csvLines.push(m.map(esc).join(',')));
      csvLines.push(''); // blank line between metadata and table
      csvLines.push(headers.map(esc).join(','));

      filteredRecords.forEach(r => {
        csvLines.push([
          esc(r.date),
          esc(r.time),
          esc(r.studentName),
          esc(r.enrollmentNo),
          esc(r.studentId || ''),
          esc(r.status)
        ].join(','));
      });

      const csvContent = csvLines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fileSubject = subject ? subject.replace(/[^a-z0-9\-\_ ]/gi, '') : 'attendance';
      a.href = url;
      a.download = `attendance_${fileSubject}_${activeTab}_${dateFrom || 'all'}_to_${dateTo || 'all'}.csv`;
      a.click();
      return;
    }

    // For summary build CSV content
    const csvContent = [
      // metadata block
      ...metadata.map(m => m.map(esc).join(',')),
      '',
      // table rows
      ...rows.map(r => r.map(esc).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fileSubject = subject ? subject.replace(/[^a-z0-9\-\_ ]/gi, '') : 'attendance';
    a.href = url;
    a.download = `attendance_summary_${fileSubject}_${dateFrom || 'all'}_to_${dateTo || 'all'}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance Records</h1>
          <p className="text-gray-600 mt-2">View and analyze attendance records across all subjects</p>
        </div>
        {selectedClass && (
          <button
            onClick={exportToCSV}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export to CSV
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Year Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedClass(''); // Reset class selection
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Years</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => {
                setSelectedSemester(e.target.value);
                setSelectedClass(''); // Reset class selection
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Semesters</option>
              {semesters.map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a Subject</option>
              {filteredClasses.map(cls => (
                <option key={cls._id} value={cls._id}>
                  {cls.subjectCode} - {cls.subjectName} ({cls.classNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Search */}
        {selectedClass && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Student</label>
            <input
              type="text"
              placeholder="Search by name or enrollment number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* No Class Selected Message */}
      {!selectedClass && !loading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-center">
          Please select a subject to view attendance records
        </div>
      )}

      {/* Statistics Cards */}
      {selectedClass && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Classes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalClasses}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Present</p>
                <p className="text-2xl font-bold text-green-600">{stats.presentCount}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Absent</p>
                <p className="text-2xl font-bold text-red-600">{stats.absentCount}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Attendance</p>
                <p className="text-2xl font-bold text-purple-600">{stats.averageAttendance}%</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {selectedClass && !loading && (
        <>
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('summary')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'summary'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Student Summary
              </button>
              <button
                onClick={() => setActiveTab('detailed')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'detailed'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Detailed Records
              </button>
            </nav>
          </div>

          {/* Student Summary Tab */}
          {activeTab === 'summary' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Enrollment No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Classes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Present
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Absent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Attendance %
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {studentSummary.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                          No attendance records found
                        </td>
                      </tr>
                    ) : (
                      studentSummary.map((student, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {student.studentName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {student.enrollmentNo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {student.totalClasses}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                            {student.present}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                            {student.absent}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getAttendanceColor(student.percentage)}`}>
                              {student.percentage}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <Link
                              to={`/admin/students/${student.studentId}`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View Profile
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detailed Records Tab */}
          {activeTab === 'detailed' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Enrollment No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                          No attendance records found
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((record, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.date}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {record.studentName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.enrollmentNo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              record.status === 'present' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.time}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};

export default AttendanceRecords;
