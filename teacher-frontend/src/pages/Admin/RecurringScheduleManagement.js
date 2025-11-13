import React, { useState, useEffect } from 'react';
import { getAllRecurringSchedules, createRecurringSchedule, getAllTeachers, getAllClasses } from '../../services/adminService';

const RecurringScheduleManagement = () => {
  const [activeTab, setActiveTab] = useState('weekly');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [recurringSchedules, setRecurringSchedules] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [schedulesRes, teachersRes, classesRes] = await Promise.all([
        getAllRecurringSchedules(),
        getAllTeachers(),
        getAllClasses()
      ]);
      
      setRecurringSchedules(schedulesRes.schedules || []);
      setTeachers(teachersRes.teachers || []);
      setClasses(classesRes.classes || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

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

  // Filter schedules by teacher or class
  const filteredSchedules = recurringSchedules.filter(schedule => {
    if (selectedTeacher && schedule.teacherId?._id !== selectedTeacher) return false;
    if (selectedClass && schedule.classId?._id !== selectedClass) return false;
    return true;
  });

  // Get today's schedule based on current day
  const todaysSchedule = () => {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = daysOfWeek[new Date().getDay()];
    return filteredSchedules.filter(s => s.dayOfWeek === today);
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this recurring schedule?')) return;
    
    try {
      // Note: You'll need to add delete endpoint in adminService
      setSuccess('Schedule deleted successfully');
      await fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete schedule');
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recurring Schedule Management</h1>
          <p className="text-gray-600 mt-1">Manage semester schedules for all teachers</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
        >
          Create Recurring Schedule
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Teacher</label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'today', name: "Today's Classes", icon: '📋' },
            { id: 'weekly', name: 'Weekly Pattern', icon: '📅' },
            { id: 'list', name: 'All Schedules', icon: '📝' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
              }`}
            >
              {tab.icon} {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">Loading schedules...</div>
        </div>
      ) : (
        <>
          {/* Today's Classes Tab */}
          {activeTab === 'today' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Today's Classes</h2>
              {todaysSchedule().length > 0 ? (
                <div className="space-y-4">
                  {todaysSchedule().map((cls) => (
                    <div key={cls._id} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-semibold text-lg">
                        {cls.classId?.subjectCode} - {cls.classId?.subjectName}
                      </h3>
                      <p className="text-gray-600 mt-1">
                        Teacher: {cls.teacherId?.fullName}
                      </p>
                      <p className="text-gray-600">
                        {cls.startTime} - {cls.endTime} | Room: {cls.roomNumber}
                      </p>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 ${
                        cls.sessionType === 'lecture' ? 'bg-blue-100 text-blue-800' :
                        cls.sessionType === 'lab' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {cls.sessionType?.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No classes today</h3>
                  <p className="text-gray-500">No recurring classes scheduled for today</p>
                </div>
              )}
            </div>
          )}

          {/* Weekly Pattern Tab */}
          {activeTab === 'weekly' && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Weekly Schedule Pattern</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => {
                    const daySchedules = filteredSchedules.filter(s => s.dayOfWeek === day);
                    return (
                      <div key={day} className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-lg mb-3 text-center">
                          <span className={`px-3 py-1 rounded-full text-sm ${getDayColor(day)}`}>{day}</span>
                        </h3>
                        {daySchedules.length > 0 ? (
                          <div className="space-y-2">
                            {daySchedules.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')).map((schedule) => (
                              <div key={schedule._id} className="bg-gray-50 rounded p-3 text-sm">
                                <div className="font-medium">{schedule.classId?.subjectCode}</div>
                                <div className="text-gray-600 text-xs">
                                  {schedule.teacherId?.fullName}
                                </div>
                                <div className="text-gray-600">
                                  {schedule.startTime} - {schedule.endTime}
                                  {schedule.sessionType === 'lab' && 
                                   ((schedule.startTime === '09:00' && schedule.endTime === '11:00') ||
                                    (schedule.startTime === '11:15' && schedule.endTime === '13:15') ||
                                    (schedule.startTime === '14:00' && schedule.endTime === '16:00')) && (
                                    <span className="ml-2 text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
                                      🔬 2hr Lab
                                    </span>
                                  )}
                                </div>
                                <div className="text-gray-500">Room: {schedule.roomNumber}</div>
                                <div className="flex justify-between items-center mt-2">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    schedule.sessionType === 'lecture' ? 'bg-blue-100 text-blue-700' :
                                    schedule.sessionType === 'lab' ? 'bg-green-100 text-green-700' :
                                    'bg-purple-100 text-purple-700'
                                  }`}>
                                    {schedule.sessionType}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteSchedule(schedule._id)}
                                    className="text-red-600 hover:text-red-800 text-xs bg-red-50 hover:bg-red-100 px-2 py-1 rounded"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-gray-500 py-4">
                            <div className="text-2xl mb-2">📭</div>
                            <div className="text-xs">No classes</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* All Schedules List Tab */}
          {activeTab === 'list' && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold">All Recurring Schedules</h2>
              </div>
              {filteredSchedules.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {filteredSchedules.map((schedule) => (
                    <div key={schedule._id} className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">{schedule.title}</h3>
                          <p className="text-gray-600 mt-1">
                            {schedule.classId?.subjectCode} - {schedule.classId?.subjectName}
                          </p>
                          <p className="text-gray-600 text-sm mt-1">
                            Teacher: {schedule.teacherId?.fullName} ({schedule.teacherId?.email})
                          </p>
                          <div className="flex items-center space-x-4 mt-2">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getDayColor(schedule.dayOfWeek)}`}>
                              {schedule.dayOfWeek}
                            </span>
                            <span className="text-sm text-gray-500">{schedule.startTime} - {schedule.endTime}</span>
                            <span className="text-sm text-gray-500">Room: {schedule.roomNumber}</span>
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              schedule.sessionType === 'lecture' ? 'bg-blue-100 text-blue-800' :
                              schedule.sessionType === 'lab' ? 'bg-green-100 text-green-800' :
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {schedule.sessionType?.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteSchedule(schedule._id)}
                          className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded-md hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No recurring schedules</h3>
                  <p className="text-gray-500 mb-4">Create your first recurring schedule to get started</p>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
                  >
                    Create Schedule
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <CreateRecurringScheduleModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchData();
            setSuccess('Recurring schedule created successfully');
            setTimeout(() => setSuccess(''), 3000);
          }}
          teachers={teachers}
          classes={classes}
        />
      )}
    </div>
  );
};

// Create Modal Component
const CreateRecurringScheduleModal = ({ isOpen, onClose, onSuccess, teachers, classes }) => {
  const [formData, setFormData] = useState({
    classId: '',
    teacherId: '',
    title: '',
    dayOfWeek: '',
    startTime: '',
    endTime: '',
    roomNumber: '',
    sessionType: 'lecture',
    semester: '',
    academicYear: '',
    semesterStartDate: '',
    semesterEndDate: '',
    frequency: 'weekly',
    description: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const sessionTypes = ['lecture', 'lab', 'project'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.classId || !formData.teacherId || !formData.title || !formData.dayOfWeek ||
        !formData.startTime || !formData.endTime || !formData.roomNumber || !formData.semester ||
        !formData.academicYear || !formData.semesterStartDate || !formData.semesterEndDate) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await createRecurringSchedule(formData);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create recurring schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold">Create Recurring Schedule</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Schedule Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., CS101 Monday Lecture"
                required
              />
            </div>

            {/* Class */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Class <span className="text-red-500">*</span>
              </label>
              <select
                name="classId"
                value={formData.classId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Class</option>
                {classes.map(cls => (
                  <option key={cls._id} value={cls._id}>
                    {cls.subjectCode} - {cls.subjectName} (Class {cls.classNumber})
                  </option>
                ))}
              </select>
            </div>

            {/* Teacher */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teacher <span className="text-red-500">*</span>
              </label>
              <select
                name="teacherId"
                value={formData.teacherId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Teacher</option>
                {teachers.map(teacher => (
                  <option key={teacher._id} value={teacher._id}>
                    {teacher.fullName} ({teacher.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Day of Week */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Day of Week <span className="text-red-500">*</span>
              </label>
              <select
                name="dayOfWeek"
                value={formData.dayOfWeek}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Day</option>
                {daysOfWeek.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>

            {/* Session Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session Type <span className="text-red-500">*</span>
              </label>
              <select
                name="sessionType"
                value={formData.sessionType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                {sessionTypes.map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Room Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="roomNumber"
                value={formData.roomNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., C201"
                required
              />
            </div>

            {/* Semester */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Semester <span className="text-red-500">*</span>
              </label>
              <select
                name="semester"
                value={formData.semester}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Semester</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                  <option key={sem} value={sem}>{sem}</option>
                ))}
              </select>
            </div>

            {/* Academic Year */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Academic Year <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="academicYear"
                value={formData.academicYear}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 2024-2025"
                required
              />
            </div>

            {/* Semester Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Semester Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="semesterStartDate"
                value={formData.semesterStartDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Semester End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Semester End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="semesterEndDate"
                value={formData.semesterEndDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows="2"
                placeholder="Optional description"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows="2"
                placeholder="Optional notes"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecurringScheduleManagement;
