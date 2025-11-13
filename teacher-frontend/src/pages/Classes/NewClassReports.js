import React, { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { classService } from '../../services/classService';
import { attendanceService } from '../../services/attendanceService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const ClassReports = () => {
  const { id } = useParams();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const chartRefTrend = useRef(null);
  const chartRefPie = useRef(null);
  const chartRefBar = useRef(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0] // today
  });

  // Fetch class details
  const { data: classData, isLoading: classLoading } = useQuery(
    ['class', id],
    () => classService.getClassById(id)
  );

  // Fetch class students
  const { data: studentsData, isLoading: studentsLoading } = useQuery(
    ['classStudents', id],
    () => classService.getClassStudents(id),
    {
      enabled: !!id,
      onSuccess: (data) => {
        console.log('Students data received:', data);
      },
      onError: (error) => {
        console.error('Error fetching students:', error);
      }
    }
  );

  // Fetch attendance records for this class
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery(
    ['classAttendance', id, selectedPeriod, dateRange],
    () => attendanceService.getAttendanceByClass(id, dateRange.startDate, dateRange.endDate),
    {
      enabled: !!id,
      onSuccess: (data) => {
        console.log('Attendance data received:', data);
        console.log('Date range used:', dateRange);
      },
      onError: (error) => {
        console.error('Error fetching attendance:', error);
      }
    }
  );

  // Calculate attendance statistics
  const calculateAttendanceStats = () => {
    console.log('Raw attendanceData:', attendanceData);
    console.log('Raw studentsData:', studentsData);
    
    if (!attendanceData || !studentsData) {
      console.log('Missing data - attendanceData:', !!attendanceData, 'studentsData:', !!studentsData);
      return {
        overall: {
          totalClasses: 0,
          averageAttendance: 0,
          totalStudents: 0,
          presentToday: 0
        },
        students: [],
        trends: []
      };
    }

    const students = Array.isArray(studentsData) ? studentsData : (studentsData?.data || studentsData?.students || []);
    const attendance = Array.isArray(attendanceData) ? attendanceData : (attendanceData?.data?.attendance || attendanceData?.attendance || attendanceData?.data || []);

    // Ensure attendance is an array
    if (!Array.isArray(attendance)) {
      console.warn('Attendance data is not an array:', attendance);
      return {
        overall: {
          totalClasses: 0,
          averageAttendance: 0,
          totalStudents: students.length,
          presentToday: 0
        },
        students: students.map(student => ({
          _id: student._id,
          name: student.name,
          enrollmentNo: student.enrollmentNo,
          attendanceRate: 0,
          totalPresent: 0,
          totalClasses: 0,
          lastAttended: 'Never'
        })),
        trends: []
      };
    }

    console.log('Extracted students:', students.length);
    console.log('Extracted attendance records:', attendance.length);

    // Filter attendance records by selected period date range
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999); // Include entire end day

    const filteredAttendance = attendance.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= startDate && recordDate <= endDate;
    });

    console.log('Filtered attendance records for period:', filteredAttendance.length);

    // Group attendance by date to count total classes in the selected period
    const classesByDate = {};
    const studentAttendance = {};

    filteredAttendance.forEach(record => {
      const date = new Date(record.timestamp).toDateString();
      const studentId = record.studentId?._id || record.studentId;
      
      if (!classesByDate[date]) {
        classesByDate[date] = new Set();
      }
      classesByDate[date].add(studentId);

      if (!studentAttendance[studentId]) {
        studentAttendance[studentId] = {
          present: 0,
          total: 0,
          lastAttended: null
        };
      }

      // If attendance record exists, student was present
      studentAttendance[studentId].present++;
      studentAttendance[studentId].lastAttended = record.timestamp;
      studentAttendance[studentId].total++;
    });

    const totalClasses = Object.keys(classesByDate).length;
    const today = new Date().toDateString();
    // Only count "present today" if today is within the selected period
    const isTodayInPeriod = new Date() >= startDate && new Date() <= endDate;
    const presentToday = (isTodayInPeriod && classesByDate[today]?.size) || 0;

    // Calculate student-wise stats
    const studentStats = students.map(student => {
      const stats = studentAttendance[student._id] || { present: 0, total: totalClasses };
      const attendanceRate = totalClasses > 0 ? (stats.present / totalClasses) * 100 : 0;

      return {
        _id: student._id,
        name: student.name,
        enrollmentNo: student.enrollmentNo,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        totalPresent: stats.present,
        totalClasses: totalClasses,
        lastAttended: stats.lastAttended ? new Date(stats.lastAttended).toLocaleDateString() : 'Never'
      };
    });

    // Calculate overall average
    const totalAttendanceRate = studentStats.reduce((sum, student) => sum + student.attendanceRate, 0);
    const averageAttendance = students.length > 0 ? totalAttendanceRate / students.length : 0;

    // Calculate daily trends based on selected period
    const trends = [];
    let trendDays;
    
    switch (selectedPeriod) {
      case 'week':
        trendDays = 7;
        break;
      case 'month':
        trendDays = 30;
        break;
      case 'semester':
        trendDays = 120;
        break;
      default:
        trendDays = 7;
    }
    
    // For week: show daily trends, for month: show weekly trends, for semester: show monthly trends
    if (selectedPeriod === 'week') {
      // Daily trends for the past week
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateString = date.toDateString();
        const dayAttendance = classesByDate[dateString]?.size || 0;
        const attendanceRate = students.length > 0 ? (dayAttendance / students.length) * 100 : 0;
        
        trends.push({
          date: date.toISOString().split('T')[0],
          attendance: Math.round(attendanceRate)
        });
      }
    } else if (selectedPeriod === 'month') {
      // Weekly trends for the past month (4 weeks)
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        let weekAttendance = 0;
        let weekDays = 0;
        
        for (let j = 0; j < 7; j++) {
          const checkDate = new Date(weekStart);
          checkDate.setDate(weekStart.getDate() + j);
          const dateString = checkDate.toDateString();
          if (classesByDate[dateString]) {
            weekAttendance += classesByDate[dateString].size;
            weekDays++;
          }
        }
        
        const avgAttendance = weekDays > 0 && students.length > 0 
          ? (weekAttendance / (weekDays * students.length)) * 100 
          : 0;
        
        trends.push({
          date: weekStart.toISOString().split('T')[0],
          attendance: Math.round(avgAttendance),
          label: `Week ${4 - i}`
        });
      }
    } else {
      // Monthly trends for the semester (4 months)
      for (let i = 3; i >= 0; i--) {
        const monthStart = new Date();
        monthStart.setMonth(monthStart.getMonth() - i);
        monthStart.setDate(1);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthStart.getMonth() + 1);
        monthEnd.setDate(0);
        
        let monthAttendance = 0;
        let monthDays = 0;
        
        // Count attendance for all days in the month
        for (const [dateString, attendees] of Object.entries(classesByDate)) {
          const checkDate = new Date(dateString);
          if (checkDate >= monthStart && checkDate <= monthEnd) {
            monthAttendance += attendees.size;
            monthDays++;
          }
        }
        
        const avgAttendance = monthDays > 0 && students.length > 0 
          ? (monthAttendance / (monthDays * students.length)) * 100 
          : 0;
        
        trends.push({
          date: monthStart.toISOString().split('T')[0],
          attendance: Math.round(avgAttendance),
          label: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
      }
    }

    return {
      overall: {
        totalClasses,
        averageAttendance: Math.round(averageAttendance * 100) / 100,
        totalStudents: students.length,
        presentToday
      },
      students: studentStats.sort((a, b) => b.attendanceRate - a.attendanceRate),
      trends
    };
  };

  const stats = calculateAttendanceStats();
  
  console.log('Calculated stats:', stats);
  console.log('Students data:', studentsData);
  console.log('Attendance data:', attendanceData);

  const getAttendanceColor = (rate) => {
    if (rate >= 85) return 'text-green-600 bg-green-100';
    if (rate >= 75) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'semester':
        startDate = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000); // 4 months
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    setDateRange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0]
    });
  };

  // Export to CSV function
  const exportToCSV = () => {
    const headers = [
      'Student Name',
      'Enrollment No',
      'Attendance Rate (%)',
      'Present/Total',
      'Last Attended',
      'Status'
    ];

    // Handle empty data case
    const csvData = stats.students.length > 0 
      ? stats.students.map(student => [
          student.name,
          student.enrollmentNo,
          student.attendanceRate,
          `${student.totalPresent}/${student.totalClasses}`,
          student.lastAttended,
          student.attendanceRate >= 75 ? 'Good' : 'Poor'
        ])
      : [['No attendance data available', '', '', '', '', '']];

    // Add summary data at the top
    const summaryData = [
      ['Class Report Summary'],
      ['Subject', classData?.subjectName || 'N/A'],
      ['Subject Code', classData?.subjectCode || 'N/A'],
      ['Period', selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)],
      ['Total Classes', stats.overall.totalClasses],
      ['Total Students', stats.overall.totalStudents],
      ['Average Attendance', `${stats.overall.averageAttendance}%`],
      ['Present Today', stats.overall.presentToday],
      ['Export Date', new Date().toLocaleDateString()],
      [''], // Empty row
      headers
    ];

    const allData = [...summaryData, ...csvData];
    
    // Convert to CSV format
    const csvContent = allData.map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_report_${classData?.subjectCode || 'class'}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF function with charts
  const exportToPDF = async () => {
    const doc = new jsPDF();
    let yPosition = 22;
    
    // Add title
    doc.setFontSize(20);
    doc.text('Attendance Report', 14, yPosition);
    yPosition += 15;
    
    // Add class information
    doc.setFontSize(12);
    doc.text(`Subject: ${classData?.subjectName || 'N/A'}`, 14, yPosition);
    yPosition += 8;
    doc.text(`Subject Code: ${classData?.subjectCode || 'N/A'}`, 14, yPosition);
    yPosition += 8;
    doc.text(`Period: ${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}`, 14, yPosition);
    yPosition += 8;
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, yPosition);
    yPosition += 15;
    
    // Add summary statistics
    doc.setFontSize(14);
    doc.text('Summary Statistics', 14, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    doc.text(`Total Classes: ${stats.overall.totalClasses}`, 14, yPosition);
    doc.text(`Average Attendance: ${stats.overall.averageAttendance}%`, 100, yPosition);
    yPosition += 8;
    doc.text(`Total Students: ${stats.overall.totalStudents}`, 14, yPosition);
    doc.text(`Present Today: ${stats.overall.presentToday}`, 100, yPosition);
    yPosition += 15;

    // Capture and add trend chart if available
    if (stats.trends.some(day => day.attendance > 0) && chartRefTrend.current) {
      try {
        const canvas = await html2canvas(chartRefTrend.current, { scale: 2, logging: false });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 180;
        const imgHeight = 90;
        doc.addImage(imgData, 'PNG', 14, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 10;
      } catch (error) {
        console.error('Error capturing trend chart:', error);
      }
    }

    // Capture and add pie chart if available
    if (stats.students.length > 0 && chartRefPie.current) {
      try {
        // Add page if needed
        if (yPosition > 200) {
          doc.addPage();
          yPosition = 15;
        }
        
        doc.setFontSize(12);
        doc.text('Attendance Distribution', 14, yPosition);
        yPosition += 8;
        
        const canvas = await html2canvas(chartRefPie.current, { scale: 2, logging: false });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 100;
        const imgHeight = 100;
        doc.addImage(imgData, 'PNG', 14, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 10;
      } catch (error) {
        console.error('Error capturing pie chart:', error);
      }
    }

    // Capture and add bar chart if available
    if (stats.students.length > 0 && chartRefBar.current) {
      try {
        // Add page if needed
        if (yPosition > 200) {
          doc.addPage();
          yPosition = 15;
        }
        
        doc.setFontSize(12);
        doc.text('Top 10 Students by Attendance', 14, yPosition);
        yPosition += 8;
        
        const canvas = await html2canvas(chartRefBar.current, { scale: 2, logging: false });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 180;
        const imgHeight = 100;
        doc.addImage(imgData, 'PNG', 14, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 10;
      } catch (error) {
        console.error('Error capturing bar chart:', error);
      }
    }

    // Add page for table if needed
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 15;
    }

    // Prepare table data
    const tableData = stats.students.length > 0 
      ? stats.students.map(student => [
          student.name,
          student.enrollmentNo,
          `${student.attendanceRate}%`,
          `${student.totalPresent}/${student.totalClasses}`,
          student.lastAttended,
          student.attendanceRate >= 75 ? 'Good' : 'Poor'
        ])
      : [['No attendance data available', '', '', '', '', '']];

    // Add table
    autoTable(doc, {
      head: [['Student Name', 'Enrollment No', 'Attendance Rate', 'Present/Total', 'Last Attended', 'Status']],
      body: tableData,
      startY: yPosition,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }, // Blue header
      alternateRowStyles: { fillColor: [249, 250, 251] }, // Light gray alternate rows
      columnStyles: {
        0: { cellWidth: 40 }, // Student Name
        1: { cellWidth: 25 }, // Enrollment No
        2: { cellWidth: 25 }, // Attendance Rate
        3: { cellWidth: 25 }, // Present/Total
        4: { cellWidth: 25 }, // Last Attended
        5: { cellWidth: 20 }  // Status
      }
    });

    // Save the PDF
    doc.save(`attendance_report_${classData?.subjectCode || 'class'}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (classLoading || studentsLoading || attendanceLoading) {
    return (
      <div className="p-6 bg-gray-900 min-h-screen dark:bg-gray-900">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-black/20 dark:border dark:border-gray-700">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 min-h-screen dark:bg-gray-900">
      {/* Breadcrumb */}
      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-3">
          <li className="inline-flex items-center">
            <Link 
              to="/dashboard/classes" 
              className="inline-flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Classes
            </Link>
          </li>
          <li>
            <div className="flex items-center">
              <span className="text-gray-400 dark:text-gray-600 mx-2">/</span>
              <Link
                to={`/dashboard/classes/${id}`}
                className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                {classData?.subjectCode}
              </Link>
            </div>
          </li>
          <li>
            <div className="flex items-center">
              <span className="text-gray-400 dark:text-gray-600 mx-2">/</span>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Reports</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Attendance Reports</h1>
          <p className="text-gray-600 dark:text-gray-400">{classData?.subjectName} - {classData?.subjectCode}</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Showing data from {new Date(dateRange.startDate).toLocaleDateString()} to {new Date(dateRange.endDate).toLocaleDateString()}
          </p>
        </div>
        
        {/* Period Filter */}
        <div className="flex space-x-2">
          {['week', 'month', 'semester'].map((period) => (
            <button
              key={period}
              onClick={() => handlePeriodChange(period)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedPeriod === period
                  ? 'bg-blue-600 dark:bg-blue-700 text-white dark:hover:bg-blue-800'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-black/20 dark:border dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Classes</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.overall.totalClasses}</p>
          {stats.overall.totalClasses === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No classes recorded yet</p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-black/20 dark:border dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Average Attendance</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.overall.averageAttendance}%</p>
          {stats.overall.totalClasses === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Start taking attendance</p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-black/20 dark:border dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Students</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.overall.totalStudents}</p>
          {stats.overall.totalStudents === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No students enrolled</p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-black/20 dark:border dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Present Today</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.overall.presentToday}</p>
          {stats.overall.presentToday === 0 && stats.overall.totalClasses > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No attendance today</p>
          )}
        </div>
      </div>

      {/* Attendance Trend Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-black/20 mb-8 dark:border dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Attendance Trend 
          {selectedPeriod === 'week' && '(Daily - Last 7 Days)'}
          {selectedPeriod === 'month' && '(Weekly - Last 4 Weeks)'}
          {selectedPeriod === 'semester' && '(Monthly - Last 4 Months)'}
        </h3>
        {stats.trends && stats.trends.length > 0 ? (
          <div ref={chartRefTrend} className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey={selectedPeriod === 'week' ? 'date' : 'label'} 
                  stroke="#9ca3af"
                />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value) => `${value}%`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="attendance" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 5 }}
                  activeDot={{ r: 7 }}
                  name="Attendance %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-80 text-gray-400 dark:text-gray-600">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-lg font-medium dark:text-gray-300">No attendance data to display</p>
            <p className="text-sm dark:text-gray-400">Take attendance to see trends here</p>
          </div>
        )}
      </div>

      {/* Charts Row - Pie Chart and Bar Chart */}
      {stats.students.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Attendance Distribution Pie Chart */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-black/20 dark:border dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Attendance Distribution
            </h3>
            <div ref={chartRefPie} className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Above 85%', value: stats.students.filter(s => s.attendanceRate >= 85).length },
                      { name: '75-85%', value: stats.students.filter(s => s.attendanceRate >= 75 && s.attendanceRate < 85).length },
                      { name: 'Below 75%', value: stats.students.filter(s => s.attendanceRate < 75).length }
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Students Bar Chart */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-black/20 dark:border dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Top 10 Students by Attendance
            </h3>
            <div ref={chartRefBar} className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.students.slice(0, 10).map(s => ({
                    name: s.name.substring(0, 10),
                    attendance: s.attendanceRate
                  }))}
                  margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    stroke="#9ca3af"
                  />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Bar dataKey="attendance" fill="#3b82f6" name="Attendance %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Student-wise Attendance Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-black/20 dark:border dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Student Attendance Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Enrollment No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Attendance Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Present/Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Attended
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {stats.students.length > 0 ? (
                stats.students.map((student) => (
                  <tr key={student._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900 dark:text-white">{student.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {student.enrollmentNo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        student.attendanceRate >= 85 
                          ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
                          : student.attendanceRate >= 75 
                          ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'
                          : 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
                      }`}>
                        {student.attendanceRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {student.totalPresent}/{student.totalClasses}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {student.lastAttended}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        student.attendanceRate >= 75 
                          ? 'text-green-800 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
                          : 'text-red-800 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
                      }`}>
                        {student.attendanceRate >= 75 ? 'Good' : 'Poor'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-500 dark:text-gray-300 text-lg font-medium">No attendance data available</p>
                      <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                        Start taking attendance to see student reports here
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Options */}
      <div className="mt-6 flex justify-end space-x-3">
        <button 
          onClick={exportToCSV}
          className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-md hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Export to CSV</span>
        </button>
        <button 
          onClick={exportToPDF}
          className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span>Export to PDF</span>
        </button>
      </div>
    </div>
  );
};

export default ClassReports;
