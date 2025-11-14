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
  const [reportMode, setReportMode] = useState('individual'); // 'individual' or 'consolidated'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
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
      enabled: !!id && reportMode === 'individual',
      onSuccess: (data) => {
        console.log('Attendance data received:', data);
        console.log('Date range used:', dateRange);
      },
      onError: (error) => {
        console.error('Error fetching attendance:', error);
      }
    }
  );

  // Fetch all classes with same subject code for consolidated report
  const { data: allClassesData, isLoading: allClassesLoading } = useQuery(
    ['allClasses'],
    () => classService.getAllClasses(),
    { enabled: reportMode === 'consolidated' && !!classData }
  );

  // Get consolidated attendance data
  const getConsolidatedAttendanceData = () => {
    if (!allClassesData || !classData) return [];
    
    const sameSubjectClasses = allClassesData.filter(c => 
      c.subjectCode === classData.subjectCode && 
      c.classId !== id
    );
    
    // In a real scenario, you'd fetch attendance for all classes
    // For now, we'll return the structure
    return sameSubjectClasses;
  };

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

  // Calculate consolidated report data
  const calculateConsolidatedStats = () => {
    if (!attendanceData || !classData) {
      return {
        byDivision: [],
        byDate: {},
        overall: { totalRecords: 0, uniqueDates: [] }
      };
    }

    // Handle different response formats
    let attendance = [];
    if (Array.isArray(attendanceData)) {
      attendance = attendanceData;
    } else if (attendanceData?.data?.attendance && Array.isArray(attendanceData.data.attendance)) {
      attendance = attendanceData.data.attendance;
    } else if (attendanceData?.data && Array.isArray(attendanceData.data)) {
      attendance = attendanceData.data;
    } else if (attendanceData?.attendance && Array.isArray(attendanceData.attendance)) {
      attendance = attendanceData.attendance;
    }

    // Ensure attendance is an array
    if (!Array.isArray(attendance)) {
      console.warn('Attendance is not an array:', attendance);
      return {
        byDivision: [],
        byDate: {},
        overall: { totalRecords: 0, uniqueDates: [] }
      };
    }

    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    // Filter by selected date if in consolidated mode
    const filteredAttendance = reportMode === 'consolidated' 
      ? attendance.filter(record => {
          try {
            const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
            return recordDate === selectedDate;
          } catch (e) {
            return false;
          }
        })
      : attendance.filter(record => {
          try {
            const recordDate = new Date(record.timestamp);
            return recordDate >= startDate && recordDate <= endDate;
          } catch (e) {
            return false;
          }
        });

    // Group by division
    const divisionData = {};
    const dateData = {};
    const uniqueDates = new Set();

    filteredAttendance.forEach(record => {
      try {
        const division = classData?.division || 'All';
        const date = new Date(record.timestamp).toISOString().split('T')[0];
        
        uniqueDates.add(date);

        if (!divisionData[division]) {
          divisionData[division] = {
            division,
            subject: classData?.subjectName,
            subjectCode: classData?.subjectCode,
            totalPresent: 0,
            totalRecords: 0,
            attendanceRate: 0
          };
        }
        divisionData[division].totalRecords++;
        divisionData[division].totalPresent++;

        if (!dateData[date]) {
          dateData[date] = { date, totalPresent: 0, divisions: {} };
        }
        dateData[date].totalPresent++;
        dateData[date].divisions[division] = (dateData[date].divisions[division] || 0) + 1;
      } catch (e) {
        console.error('Error processing record:', e);
      }
    });

    // Calculate attendance rates
    Object.values(divisionData).forEach(div => {
      if (div.totalRecords > 0) {
        div.attendanceRate = Math.round((div.totalPresent / div.totalRecords) * 100);
      }
    });

    return {
      byDivision: Object.values(divisionData),
      byDate: dateData,
      overall: {
        totalRecords: filteredAttendance.length,
        uniqueDates: Array.from(uniqueDates).sort()
      }
    };
  };

  const consolidatedStats = calculateConsolidatedStats();

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
    const doc = new jsPDF('p', 'mm', 'a4');
    let yPosition = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 14;
    const marginRight = 14;
    const contentWidth = pageWidth - marginLeft - marginRight;
    
    // ========== HEADER SECTION ==========
    // Add colored header background
    doc.setFillColor(41, 128, 185); // Professional blue
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Add title in header
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text('ATTENDANCE REPORT', marginLeft, 15);
    
    // Add date in header
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, marginLeft, 25);
    
    yPosition = 40;
    
    // ========== CLASS INFORMATION SECTION ==========
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(41, 128, 185);
    doc.text('CLASS INFORMATION', marginLeft, yPosition);
    yPosition += 6;
    
    // Info box background
    doc.setFillColor(240, 248, 255); // Alice blue
    doc.rect(marginLeft, yPosition - 3, contentWidth, 22, 'F');
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.5);
    doc.rect(marginLeft, yPosition - 3, contentWidth, 22);
    
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    
    // Get class info from attendance records if available
    let classNumberInfo = classData?.classNumber || 'N/A';
    
    const infoLines = [
      `Class: ${classNumberInfo}`,
      `Subject: ${classData?.subjectName || 'N/A'} (${classData?.subjectCode || 'N/A'})`,
      `Teacher: ${classData?.teacherName || 'N/A'}`
    ];
    
    infoLines.forEach((line, idx) => {
      doc.text(line, marginLeft + 4, yPosition + 3 + (idx * 6));
    });
    
    yPosition += 28;
    
    // ========== PERIOD INFORMATION SECTION ==========
    doc.setFont(undefined, 'bold');
    doc.setTextColor(41, 128, 185);
    doc.text('REPORTING PERIOD', marginLeft, yPosition);
    yPosition += 6;
    
    // Period info box
    doc.setFillColor(240, 248, 255);
    doc.rect(marginLeft, yPosition - 3, contentWidth, 14, 'F');
    doc.setLineWidth(0.5);
    doc.rect(marginLeft, yPosition - 3, contentWidth, 14);
    
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    const periodText = `From: ${new Date(dateRange.startDate).toLocaleDateString()}   •   To: ${new Date(dateRange.endDate).toLocaleDateString()}`;
    doc.text(periodText, marginLeft + 4, yPosition + 2);
    
    yPosition += 18;
    
    // ========== KEY STATISTICS SECTION ==========
    doc.setFont(undefined, 'bold');
    doc.setTextColor(41, 128, 185);
    doc.text('KEY STATISTICS', marginLeft, yPosition);
    yPosition += 6;
    
    // Stats boxes with better colors
    const statsBoxHeight = 16;
    const statsBoxWidth = contentWidth / 2 - 1;
    const boxColors = [
      { fill: [76, 175, 80], text: 'Working Days' },        // Green
      { fill: [33, 150, 243], text: 'Avg. Attendance' },    // Blue
      { fill: [156, 39, 176], text: 'Total Students' },     // Purple
      { fill: [255, 152, 0], text: 'Min. Required' }        // Orange
    ];
    
    const statsData = [
      stats.overall.totalClasses,
      `${stats.overall.averageAttendance}%`,
      stats.overall.totalStudents,
      '80%'
    ];
    
    // Create 2x2 grid of stat boxes
    for (let i = 0; i < 4; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const boxX = marginLeft + (col * (statsBoxWidth + 2));
      const boxY = yPosition + (row * (statsBoxHeight + 2));
      
      // Box background
      doc.setFillColor(...boxColors[i].fill);
      doc.rect(boxX, boxY, statsBoxWidth, statsBoxHeight, 'F');
      
      // Box border
      doc.setDrawColor(...boxColors[i].fill);
      doc.setLineWidth(0.5);
      doc.rect(boxX, boxY, statsBoxWidth, statsBoxHeight);
      
      // Text
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      doc.text(boxColors[i].text, boxX + 4, boxY + 5);
      
      doc.setFont(undefined, 'bold');
      doc.setFontSize(14);
      doc.text(statsData[i].toString(), boxX + 4, boxY + 12);
    }
    
    yPosition += 40;
    
    // ========== SUMMARY TABLE SECTION ==========
    if (stats.trends && stats.trends.length > 0) {
      doc.setTextColor(41, 128, 185);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text('ATTENDANCE TREND SUMMARY', marginLeft, yPosition);
      yPosition += 6;
      
      // Prepare period data
      const periodData = {};
      stats.trends.forEach(trend => {
        const date = new Date(trend.date);
        const periodLabel = trend.label || date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
        periodData[periodLabel] = trend.attendance;
      });
      
      // Create table headers
      const periodHeaders = Object.keys(periodData).slice(0, 5);
      const headers = ['Metric', ...periodHeaders, 'Average'];
      
      // Create table rows
      const rows = [
        [
          'Attendance %',
          ...periodHeaders.map(p => `${periodData[p]}%`),
          `${stats.overall.averageAttendance}%`
        ]
      ];
      
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: yPosition,
        styles: { 
          fontSize: 8, 
          cellPadding: 4,
          halign: 'center',
          valign: 'middle'
        },
        headStyles: { 
          fillColor: [41, 128, 185], 
          textColor: 255, 
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: { fillColor: [245, 248, 250] },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', fillColor: [230, 240, 250] }
        }
      });
      
      yPosition = doc.lastAutoTable.finalY + 8;
    }

    // Add page break if needed
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 10;
    }

    // ========== STUDENT ATTENDANCE TABLE ==========
    doc.setTextColor(41, 128, 185);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('STUDENT ATTENDANCE DETAILS', marginLeft, yPosition);
    yPosition += 6;

    // Prepare table data with color coding
    const tableData = stats.students.length > 0 
      ? stats.students.map((student, idx) => {
          const status = student.attendanceRate >= 80 
            ? 'Good' 
            : student.attendanceRate >= 70 
            ? 'Fair' 
            : 'Below Target';
          return [
            student.name,
            student.enrollmentNo,
            `${student.attendanceRate}%`,
            `${student.totalPresent}/${student.totalClasses}`,
            status
          ];
        })
      : [['No attendance data available', '', '', '', '']];

    // Color code the status column
    const getStatusColor = (status) => {
      switch(status) {
        case 'Good':
          return { fillColor: [200, 230, 201], textColor: [0, 0, 0] }; // Light green
        case 'Fair':
          return { fillColor: [255, 243, 224], textColor: [0, 0, 0] }; // Light orange
        case 'Below Target':
          return { fillColor: [255, 205, 210], textColor: [0, 0, 0] }; // Light red
        default:
          return { fillColor: [245, 248, 250], textColor: [0, 0, 0] };
      }
    };

    // Add table
    autoTable(doc, {
      head: [['Student Name', 'Enrollment No', 'Attendance %', 'Present / Total', 'Status']],
      body: tableData,
      startY: yPosition,
      styles: { 
        fontSize: 8, 
        cellPadding: 4,
        valign: 'middle'
      },
      headStyles: { 
        fillColor: [41, 128, 185], 
        textColor: 255, 
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: { fillColor: [245, 248, 250] },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 55, halign: 'left' },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 32, halign: 'center' },
        4: { cellWidth: 28, halign: 'center', fontStyle: 'bold' }
      },
      didDrawCell: (data) => {
        // Color code status column
        if (data.column.index === 4 && data.row.index > 0) {
          const status = data.row.raw[4];
          const colors = getStatusColor(status);
          data.cell.styles.fillColor = colors.fillColor;
          data.cell.styles.textColor = colors.textColor;
        }
      }
    });

    // ========== FOOTER SECTION ==========
    const totalPages = doc.getNumberOfPages();
    
    // Get class number from classData
    const classNumberForFilename = classData?.classNumber || 'class';
    
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Add footer line
      doc.setDrawColor(41, 128, 185);
      doc.setLineWidth(0.5);
      doc.line(marginLeft, pageHeight - 12, pageWidth - marginRight, pageHeight - 12);
      
      // Add footer text
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont(undefined, 'normal');
      doc.text(`Page ${i} of ${totalPages}`, marginLeft, pageHeight - 7);
      doc.text('SARVAJANIK COLLEGE OF ENGINEERING & TECHNOLOGY', pageWidth / 2, pageHeight - 7, { align: 'center' });
      doc.text(new Date().toLocaleDateString(), pageWidth - marginRight, pageHeight - 7, { align: 'right' });
    }

    // Save the PDF
    doc.save(`attendance_report_${classNumberForFilename}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (classLoading || studentsLoading || (attendanceLoading && reportMode === 'individual') || (allClassesLoading && reportMode === 'consolidated')) {
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
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
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
            {reportMode === 'consolidated' 
              ? `Consolidated Report for ${classData?.subjectCode} on ${new Date(selectedDate).toLocaleDateString()}`
              : `Showing data from ${new Date(dateRange.startDate).toLocaleDateString()} to ${new Date(dateRange.endDate).toLocaleDateString()}`
            }
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

      {/* Report Mode Toggle */}
      <div className="flex space-x-3 mb-6">
        <button
          onClick={() => setReportMode('individual')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
            reportMode === 'individual'
              ? 'bg-blue-600 dark:bg-blue-700 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>Individual Class</span>
        </button>
        <button
          onClick={() => setReportMode('consolidated')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
            reportMode === 'consolidated'
              ? 'bg-purple-600 dark:bg-purple-700 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 00-2 2m2-2a2 2 0 012 2m-6-10a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2m-6-2v2m0 0h.01" />
          </svg>
          <span>Consolidated (By Date & Division)</span>
        </button>
      </div>

      {reportMode === 'consolidated' && (
        <>
          {/* Consolidated Report Date Selector */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-black/20 dark:border dark:border-gray-700 mb-8">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select Date for Consolidated Report</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full md:w-1/3 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Consolidated Report Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-200 dark:border-purple-700 p-6 rounded-lg shadow dark:shadow-black/20">
              <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">Total Attendance Records</h3>
              <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{consolidatedStats.overall.totalRecords}</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">On {new Date(selectedDate).toLocaleDateString()}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border border-blue-200 dark:border-blue-700 p-6 rounded-lg shadow dark:shadow-black/20">
              <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Subject</h3>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{classData?.subjectCode}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{classData?.subjectName}</p>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 border border-indigo-200 dark:border-indigo-700 p-6 rounded-lg shadow dark:shadow-black/20">
              <h3 className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">Division</h3>
              <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">{classData?.division || 'N/A'}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Class Division</p>
            </div>
          </div>

          {/* Division-wise Consolidated Data */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-black/20 dark:border dark:border-gray-700 mb-8">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Consolidated Attendance by Division</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">All divisions for {classData?.subjectCode} on {new Date(selectedDate).toLocaleDateString()}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Division</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Present</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Records</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {consolidatedStats.byDivision.length > 0 ? (
                    consolidatedStats.byDivision.map((div, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{div.division}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-300">{div.subject}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-300">{div.totalPresent}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-300">{div.totalRecords}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                            div.attendanceRate >= 85 
                              ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
                              : div.attendanceRate >= 75 
                              ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'
                              : 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
                          }`}>
                            {div.attendanceRate}%
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        No data available for the selected date
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Date Information */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-8">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Available Dates:</strong> {consolidatedStats.overall.uniqueDates.length > 0 
                ? consolidatedStats.overall.uniqueDates.join(', ') 
                : 'No attendance data available'}
            </p>
          </div>
        </>
      )}

      {reportMode === 'individual' && (
      <>
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
      </>
      )}
    </div>
  );
};

export default ClassReports;
