import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  getAllSchedules, 
  createSchedule, 
  deleteSchedule,
  getAllTeachers, 
  getAllClasses, 
  createRecurringSchedule,
  getAllRecurringSchedules,
  deleteRecurringSchedule
} from '../../services/adminService';

const ScheduleManagement = () => {
  const [activeTab, setActiveTab] = useState('regular'); // 'regular' or 'semester'
  const [schedules, setSchedules] = useState([]);
  const [recurringSchedules, setRecurringSchedules] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [sortBy, setSortBy] = useState('dayOfWeek'); // dayOfWeek, startTime, teacherName, subjectName
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterDay, setFilterDay] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [scheduleType, setScheduleType] = useState('regular'); // 'regular' or 'recurring'
  const [formData, setFormData] = useState({
    classId: '',
    teacherId: '',
    dayOfWeek: '',
    startTime: '',
    endTime: '',
    roomNumber: '',
    sessionType: 'lecture',
    semester: '',
    academicYear: '',
    // Recurring schedule specific fields
    title: '',
    semesterStartDate: '',
    semesterEndDate: '',
    frequency: 'weekly'
  });
  
  // Weekly schedule for recurring schedules
  const [weeklySchedule, setWeeklySchedule] = useState({
    Monday: { enabled: false, startTime: '', endTime: '', roomNumber: '', sessionType: 'lecture' },
    Tuesday: { enabled: false, startTime: '', endTime: '', roomNumber: '', sessionType: 'lecture' },
    Wednesday: { enabled: false, startTime: '', endTime: '', roomNumber: '', sessionType: 'lecture' },
    Thursday: { enabled: false, startTime: '', endTime: '', roomNumber: '', sessionType: 'lecture' },
    Friday: { enabled: false, startTime: '', endTime: '', roomNumber: '', sessionType: 'lecture' },
    Saturday: { enabled: false, startTime: '', endTime: '', roomNumber: '', sessionType: 'lecture' }
  });

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  const sessionTypes = ['lecture', 'lab', 'project'];

  useEffect(() => {
    fetchSchedules();
    fetchRecurringSchedules();
    fetchTeachers();
    fetchClasses();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const response = await getAllSchedules();
      console.log('Schedules response:', response);
      setSchedules(response.schedules || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch schedules');
      console.error('Error fetching schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecurringSchedules = async () => {
    try {
      const response = await getAllRecurringSchedules();
      console.log('Recurring schedules response:', response);
      console.log('Recurring schedules array:', response.schedules || []);
      setRecurringSchedules(response.schedules || []);
    } catch (err) {
      console.error('Error fetching recurring schedules:', err);
      console.error('Full error:', err.response || err);
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await getAllTeachers();
      setTeachers(response.teachers || []);
    } catch (err) {
      console.error('Error fetching teachers:', err);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await getAllClasses();
      setClasses(response.classes || []);
    } catch (err) {
      console.error('Error fetching classes:', err);
    }
  };

  const handleDeleteRegularSchedule = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) return;
    
    try {
      await deleteSchedule(scheduleId);
      setSuccess('Schedule deleted successfully');
      fetchSchedules(); // Refresh the schedules list
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete schedule');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    try {
      if (scheduleType === 'recurring') {
        // Create recurring schedule for each enabled day
        const enabledDays = Object.keys(weeklySchedule).filter(day => weeklySchedule[day].enabled);
        
        if (enabledDays.length === 0) {
          alert('Please enable at least one day for the recurring schedule');
          return;
        }

        // Create a recurring schedule for each enabled day
        const promises = enabledDays.map(day => {
          const daySchedule = weeklySchedule[day];
          return createRecurringSchedule({
            ...formData,
            dayOfWeek: day,
            startTime: daySchedule.startTime,
            endTime: daySchedule.endTime,
            roomNumber: daySchedule.roomNumber,
            sessionType: daySchedule.sessionType,
            title: `${formData.title} - ${day}`
          });
        });

        await Promise.all(promises);
      } else {
        await createSchedule(formData);
      }
      
      setShowCreateModal(false);
      setScheduleType('regular');
      setFormData({
        classId: '',
        teacherId: '',
        dayOfWeek: '',
        startTime: '',
        endTime: '',
        roomNumber: '',
        sessionType: 'lecture',
        semester: '',
        academicYear: '',
        title: '',
        semesterStartDate: '',
        semesterEndDate: '',
        frequency: 'weekly'
      });
      setWeeklySchedule({
        Monday: { enabled: false, startTime: '', endTime: '', roomNumber: '', sessionType: 'lecture' },
        Tuesday: { enabled: false, startTime: '', endTime: '', roomNumber: '', sessionType: 'lecture' },
        Wednesday: { enabled: false, startTime: '', endTime: '', roomNumber: '', sessionType: 'lecture' },
        Thursday: { enabled: false, startTime: '', endTime: '', roomNumber: '', sessionType: 'lecture' },
        Friday: { enabled: false, startTime: '', endTime: '', roomNumber: '', sessionType: 'lecture' },
        Saturday: { enabled: false, startTime: '', endTime: '', roomNumber: '', sessionType: 'lecture' }
      });
      fetchSchedules();
      alert(`${scheduleType === 'recurring' ? 'Recurring schedule' : 'Schedule'} created successfully!`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create schedule');
    }
  };

  // Get unique semesters for filter
  const semesters = [...new Set(schedules.map(s => s.semester))].filter(Boolean).sort();

  // Filter and sort schedules
  const filteredSchedules = schedules
    .filter(schedule => {
      const teacherName = schedule.teacherId?.fullName || '';
      const subjectName = schedule.classId?.subjectName || '';
      const subjectCode = schedule.classId?.subjectCode || '';
      const classNumber = schedule.classId?.classNumber || '';
      
      const matchesSearch = 
        teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        subjectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        classNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.roomNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDay = !filterDay || schedule.dayOfWeek === filterDay;
      const matchesSemester = !filterSemester || schedule.semester === filterSemester;
      const matchesStatus = !filterStatus || 
        (filterStatus === 'active' && schedule.isActive) ||
        (filterStatus === 'inactive' && !schedule.isActive);

      return matchesSearch && matchesDay && matchesSemester && matchesStatus;
    })
    .sort((a, b) => {
      let aVal, bVal;
      
      if (sortBy === 'dayOfWeek') {
        aVal = dayOrder[a.dayOfWeek] || 0;
        bVal = dayOrder[b.dayOfWeek] || 0;
      } else if (sortBy === 'startTime') {
        aVal = a.startTime || '';
        bVal = b.startTime || '';
      } else if (sortBy === 'teacherName') {
        aVal = a.teacherId?.fullName || '';
        bVal = b.teacherId?.fullName || '';
      } else if (sortBy === 'subjectName') {
        aVal = a.classId?.subjectName || '';
        bVal = b.classId?.subjectName || '';
      } else {
        aVal = a[sortBy] || '';
        bVal = b[sortBy] || '';
      }
      
      if (typeof aVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      if (sortOrder === 'asc') {
        return aVal.toString().localeCompare(bVal.toString());
      } else {
        return bVal.toString().localeCompare(aVal.toString());
      }
    });

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortBy !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Schedule Management</h1>
          <p className="text-gray-600 mt-2">View and manage all schedules across the system</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Schedule
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('regular')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'regular'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Regular Schedules
          </button>
          <button
            onClick={() => setActiveTab('semester')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'semester'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Semester Schedule
          </button>
        </nav>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Conditional Content Based on Active Tab */}
      {activeTab === 'regular' && (
        <div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by teacher, subject, class, or room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>

          {/* Day Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Day</label>
            <select
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              <option value="">All Days</option>
              {daysOfWeek.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              <option value="">All Semesters</option>
              {semesters.map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredSchedules.length} of {schedules.length} schedules
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Schedules Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600"></div>
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No schedules found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('dayOfWeek')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Day</span>
                      <SortIcon field="dayOfWeek" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('startTime')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Time</span>
                      <SortIcon field="startTime" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('subjectName')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Subject</span>
                      <SortIcon field="subjectName" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('teacherName')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Teacher</span>
                      <SortIcon field="teacherName" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Room
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Semester
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSchedules.map((schedule) => (
                  <tr key={schedule._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {schedule.dayOfWeek || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {schedule.startTime} - {schedule.endTime}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {schedule.classId?.subjectName || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {schedule.classId?.subjectCode || ''} {schedule.classId?.classNumber || ''}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {schedule.teacherId?.fullName || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {schedule.roomNumber || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        {schedule.sessionType || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {schedule.semester || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        schedule.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {schedule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <Link
                          to={`/admin/teachers/${schedule.teacherId?._id}`}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          View Teacher
                        </Link>
                        <button
                          onClick={() => handleDeleteRegularSchedule(schedule._id)}
                          className="text-red-600 hover:text-red-900 font-medium"
                          title="Delete Schedule"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Create New Schedule</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-4">
              {/* Schedule Type Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Schedule Type</label>
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setScheduleType('regular')}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                      scheduleType === 'regular'
                        ? 'border-yellow-600 bg-yellow-50 text-yellow-600'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Regular Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('recurring')}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                      scheduleType === 'recurring'
                        ? 'border-yellow-600 bg-yellow-50 text-yellow-600'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Recurring Schedule
                  </button>
                </div>
                {scheduleType === 'recurring' && (
                  <p className="text-xs text-gray-500 mt-2">
                    Creates a template for semester-long recurring sessions
                  </p>
                )}
              </div>

              {/* Title (Recurring Only) */}
              {scheduleType === 'recurring' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Data Structures Lab - Fall 2025"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Teacher Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Teacher *</label>
                <select
                  required
                  value={formData.teacherId}
                  onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                >
                  <option value="">Select Teacher</option>
                  {teachers.map(teacher => (
                    <option key={teacher._id} value={teacher._id}>
                      {teacher.fullName || teacher.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
                <select
                  required
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                >
                  <option value="">Select Class</option>
                  {classes.map(cls => (
                    <option key={cls._id} value={cls._id}>
                      {cls.subjectName} - {cls.classNumber} ({cls.semester})
                    </option>
                  ))}
                </select>
              </div>

              {/* Conditional Fields based on Schedule Type */}
              {scheduleType === 'regular' ? (
                <>
                  {/* Day of Week */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Day of Week *</label>
                    <select
                      required
                      value={formData.dayOfWeek}
                      onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    >
                      <option value="">Select Day</option>
                      {daysOfWeek.map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>

                  {/* Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label>
                      <input
                        type="time"
                        required
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Time *</label>
                      <input
                        type="time"
                        required
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Room Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Room Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., C-204, E-201"
                      value={formData.roomNumber}
                      onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>

                  {/* Session Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Session Type *</label>
                    <select
                      required
                      value={formData.sessionType}
                      onChange={(e) => setFormData({ ...formData, sessionType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    >
                      {sessionTypes.map(type => (
                        <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* Weekly Schedule Grid */}
                  <div className="border border-gray-300 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Weekly Schedule *</label>
                    <p className="text-xs text-gray-500 mb-4">Enable days and set times for recurring classes</p>
                    
                    <div className="space-y-3">
                      {daysOfWeek.map(day => (
                        <div key={day} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center mb-2">
                            <input
                              type="checkbox"
                              id={`day-${day}`}
                              checked={weeklySchedule[day].enabled}
                              onChange={(e) => setWeeklySchedule({
                                ...weeklySchedule,
                                [day]: { ...weeklySchedule[day], enabled: e.target.checked }
                              })}
                              className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                            />
                            <label htmlFor={`day-${day}`} className="ml-2 font-medium text-gray-900">
                              {day}
                            </label>
                          </div>
                          
                          {weeklySchedule[day].enabled && (
                            <div className="ml-6 grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                                <input
                                  type="time"
                                  required
                                  value={weeklySchedule[day].startTime}
                                  onChange={(e) => setWeeklySchedule({
                                    ...weeklySchedule,
                                    [day]: { ...weeklySchedule[day], startTime: e.target.value }
                                  })}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">End Time</label>
                                <input
                                  type="time"
                                  required
                                  value={weeklySchedule[day].endTime}
                                  onChange={(e) => setWeeklySchedule({
                                    ...weeklySchedule,
                                    [day]: { ...weeklySchedule[day], endTime: e.target.value }
                                  })}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Room Number</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g., C-204"
                                  value={weeklySchedule[day].roomNumber}
                                  onChange={(e) => setWeeklySchedule({
                                    ...weeklySchedule,
                                    [day]: { ...weeklySchedule[day], roomNumber: e.target.value }
                                  })}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Session Type</label>
                                <select
                                  required
                                  value={weeklySchedule[day].sessionType}
                                  onChange={(e) => setWeeklySchedule({
                                    ...weeklySchedule,
                                    [day]: { ...weeklySchedule[day], sessionType: e.target.value }
                                  })}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                >
                                  {sessionTypes.map(type => (
                                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Semester & Academic Year */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Semester *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., VII, VIII"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 2025-26"
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Recurring Schedule Fields */}
              {scheduleType === 'recurring' && (
                <>
                  {/* Semester Date Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Semester Start Date *</label>
                      <input
                        type="date"
                        required
                        value={formData.semesterStartDate}
                        onChange={(e) => setFormData({ ...formData, semesterStartDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Semester End Date *</label>
                      <input
                        type="date"
                        required
                        value={formData.semesterEndDate}
                        onChange={(e) => setFormData({ ...formData, semesterEndDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Frequency */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Frequency *</label>
                    <select
                      required
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly (Every 2 weeks)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      This schedule will repeat {formData.frequency === 'weekly' ? 'every week' : 'every 2 weeks'} throughout the semester
                    </p>
                  </div>
                </>
              )}

              {/* Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setScheduleType('regular');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Create {scheduleType === 'recurring' ? 'Recurring' : ''} Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
      )}

      {/* Semester Schedule Tab Content */}
      {activeTab === 'semester' && (
        loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600"></div>
          </div>
        ) : (
          <SemesterScheduleTab
            recurringSchedules={recurringSchedules}
            teachers={teachers}
            classes={classes}
            selectedTeacher={selectedTeacher}
            setSelectedTeacher={setSelectedTeacher}
            selectedClass={selectedClass}
            setSelectedClass={setSelectedClass}
            onRefresh={fetchRecurringSchedules}
            setError={setError}
            setSuccess={setSuccess}
          />
        )
      )}
    </div>
  );
};

// Semester Schedule Tab Component
const SemesterScheduleTab = ({ 
  recurringSchedules, 
  teachers, 
  classes, 
  selectedTeacher, 
  setSelectedTeacher,
  selectedClass,
  setSelectedClass,
  onRefresh,
  setError,
  setSuccess
}) => {
  const [activeSubTab, setActiveSubTab] = useState('weekly');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const getDayColor = (day) => {
    const colors = {
      'Monday': 'bg-blue-100 text-blue-800',
      'Tuesday': 'bg-green-100 text-green-800',
      'Wednesday': 'bg-yellow-100 text-yellow-800',
      'Thursday': 'bg-purple-100 text-purple-800',
      'Friday': 'bg-red-100 text-red-800',
      'Saturday': 'bg-indigo-100 text-indigo-800'
    };
    return colors[day] || 'bg-gray-100 text-gray-800';
  };

  console.log('SemesterScheduleTab received recurringSchedules:', recurringSchedules);
  console.log('Total recurring schedules count:', recurringSchedules?.length || 0);

  const filteredSchedules = recurringSchedules.filter(schedule => {
    if (selectedTeacher && schedule.teacherId?._id !== selectedTeacher) return false;
    if (selectedClass && schedule.classId?._id !== selectedClass) return false;
    return true;
  });

  console.log('Filtered schedules count:', filteredSchedules.length);

  const todaysSchedule = () => {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = daysOfWeek[new Date().getDay()];
    return filteredSchedules.filter(s => s.dayOfWeek === today);
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this recurring schedule?')) return;
    
    try {
      await deleteRecurringSchedule(scheduleId);
      setSuccess('Schedule deleted successfully');
      await onRefresh();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete schedule');
    }
  };

  const groupByDay = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days.map(day => ({
      day,
      schedules: filteredSchedules.filter(s => s.dayOfWeek === day)
    }));
  };

  return (
    <div>
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="mb-4 text-sm text-gray-600">
          Total Recurring Schedules: <span className="font-semibold">{recurringSchedules?.length || 0}</span>
          {filteredSchedules.length !== recurringSchedules?.length && (
            <span> | Filtered: <span className="font-semibold">{filteredSchedules.length}</span></span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Teacher</label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              <option value="">All Teachers</option>
              {teachers.map(teacher => (
                <option key={teacher._id} value={teacher._id}>
                  {teacher.fullName} ({teacher.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              <option value="">All Classes</option>
              {classes.map(cls => (
                <option key={cls._id} value={cls._id}>
                  {cls.subjectCode} - {cls.subjectName} (Class {cls.classNumber})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'today', name: "Today's Classes", icon: '📋' },
            { id: 'weekly', name: 'Weekly Pattern', icon: '📅' },
            { id: 'list', name: 'All Schedules', icon: '📝' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm inline-flex items-center ${
                activeSubTab === tab.id
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Today's Schedule */}
      {activeSubTab === 'today' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Today's Recurring Classes ({todaysSchedule().length})
            </h3>
            {todaysSchedule().length === 0 ? (
              <p className="text-gray-500 text-center py-8">No recurring classes scheduled for today</p>
            ) : (
              <div className="space-y-3">
                {todaysSchedule().map(schedule => (
                  <div key={schedule._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDayColor(schedule.dayOfWeek)}`}>
                            {schedule.dayOfWeek}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {schedule.startTime} - {schedule.endTime}
                          </span>
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                            {schedule.sessionType}
                          </span>
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1">
                          {schedule.classId?.subjectCode} - {schedule.classId?.subjectName}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Teacher: {schedule.teacherId?.fullName} | Room: {schedule.roomNumber}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {schedule.semester} • {schedule.academicYear}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteSchedule(schedule._id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weekly Pattern */}
      {activeSubTab === 'weekly' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Schedule Pattern</h3>
            <div className="space-y-6">
              {groupByDay().map(({ day, schedules }) => (
                <div key={day} className="border-l-4 border-yellow-500 pl-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">{day}</h4>
                    <span className="text-sm text-gray-500">{schedules.length} classes</span>
                  </div>
                  {schedules.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">No classes scheduled</p>
                  ) : (
                    <div className="space-y-2">
                      {schedules.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(schedule => (
                        <div key={schedule._id} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">
                                {schedule.startTime} - {schedule.endTime}
                              </span>
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                                {schedule.sessionType}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">
                              {schedule.classId?.subjectCode} - {schedule.classId?.subjectName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {schedule.teacherId?.fullName} • Room {schedule.roomNumber}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteSchedule(schedule._id)}
                            className="text-red-600 hover:text-red-800 ml-4"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* All Schedules List */}
      {activeSubTab === 'list' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                All Recurring Schedules ({filteredSchedules.length})
              </h3>
            </div>
            {filteredSchedules.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No recurring schedules found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Semester</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredSchedules.map(schedule => (
                      <tr key={schedule._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDayColor(schedule.dayOfWeek)}`}>
                            {schedule.dayOfWeek}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {schedule.startTime} - {schedule.endTime}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div>{schedule.classId?.subjectCode}</div>
                          <div className="text-xs text-gray-500">{schedule.classId?.subjectName}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {schedule.teacherId?.fullName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {schedule.roomNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                            {schedule.sessionType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div>{schedule.semester}</div>
                          <div className="text-xs text-gray-500">{schedule.academicYear}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleDeleteSchedule(schedule._id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleManagement;
