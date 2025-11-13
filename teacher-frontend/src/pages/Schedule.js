import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { scheduleService } from '../services/scheduleService';
import { recurringScheduleService } from '../services/recurringScheduleService';
import { classService } from '../services/classService';
import { timeSlotService } from '../services/timeSlotService';
import { useModal } from '../hooks/useModal';
import AlertModal from '../components/common/AlertModal';
import ConfirmModal from '../components/common/ConfirmModal';

const SchedulePage = () => {
  const [activeTab, setActiveTab] = useState('weekly'); // 'weekly', 'semester'
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateRecurringModal, setShowCreateRecurringModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [mergeData, setMergeData] = useState({ sourceId: '', targetId: '', customLabel: '' });
  const [formData, setFormData] = useState({
    classId: '',
    dayOfWeek: '',
    timeSlotId: '',
    roomId: '',
    customRoom: ''
  });

  const [recurringFormData, setRecurringFormData] = useState({
    classId: '',
    sessionType: 'lecture',
    dayOfWeek: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    roomNumber: '',
    semester: 'VII',
    academicYear: '2025-26',
    semesterStartDate: '2025-08-01',
    semesterEndDate: '2025-12-15',
    description: '',
    notes: ''
  });

  const queryClient = useQueryClient();
  const { alertModal, confirmModal, showAlert, showConfirm, closeAlert, closeConfirm } = useModal();

  // Get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  // Get current week in YYYY-WXX format from date
  const getWeekFromDate = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date - startOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const currentDate = getCurrentDate();
    setSelectedDate(currentDate);
    setSelectedWeek(getWeekFromDate(currentDate));
  }, []);

  // Update week when date changes
  useEffect(() => {
    if (selectedDate) {
      setSelectedWeek(getWeekFromDate(selectedDate));
    }
  }, [selectedDate]);

  // Fetch weekly schedule - now fetches all teacher's schedules regardless of semester/year
  const { data: weeklySchedule, isLoading, error } = useQuery({
    queryKey: ['weeklySchedule', selectedWeek],
    queryFn: () => scheduleService.getWeeklySchedule({
      week: selectedWeek
    }),
    enabled: !!selectedWeek
  });

  // Fetch classes for dropdown
  const { data: classesData, isLoading: classesLoading, error: classesError } = useQuery({
    queryKey: ['classes'],
    queryFn: classService.getClasses,
    onSuccess: (data) => {
      console.log('Classes data loaded:', data);
    },
    onError: (error) => {
      console.error('Classes loading error:', error);
    }
  });

  // Fetch available time slots
  const { data: availableTimeSlots = [], isLoading: timeSlotsLoading } = useQuery({
    queryKey: ['availableTimeSlots'],
    queryFn: timeSlotService.getAvailableTimeSlots,
    onError: (error) => {
      console.error('Time slots loading error:', error);
    }
  });

  // Fetch recurring schedules
  const { data: recurringSchedules, isLoading: recurringLoading } = useQuery({
    queryKey: ['recurringSchedules'],
    queryFn: recurringScheduleService.getRecurringSchedules,
    enabled: activeTab === 'semester',
    onSuccess: (data) => {
      console.log('=== RECURRING SCHEDULES FETCHED ===');
      console.log('Raw response:', data);
      console.log('Schedules array:', data?.data);
      console.log('Number of schedules:', data?.data?.length || 0);
      if (data?.data) {
        data.data.forEach((schedule, index) => {
          console.log(`Schedule ${index + 1}:`, {
            id: schedule._id,
            title: schedule.title,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            sessionType: schedule.sessionType,
            classId: schedule.classId,
            isActive: schedule.isActive
          });
        });
      }
    }
  });

  // Fetch today's schedule
  const { data: todaysSchedule } = useQuery({
    queryKey: ['todaysSchedule'],
    queryFn: recurringScheduleService.getTodaysSchedule,
    enabled: activeTab === 'semester'
  });

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: scheduleService.createSchedule,
    onSuccess: () => {
      showAlert('Schedule created successfully!', 'success');
      setShowCreateModal(false);
      setFormData({
        classId: '',
        dayOfWeek: '',
        timeSlotId: '',
        roomId: '',
        customRoom: ''
      });
      queryClient.invalidateQueries(['weeklySchedule']);
    },
    onError: (error) => {
      showAlert(`Error: ${error.response?.data?.message || 'Failed to create schedule'}`, 'error');
    }
  });

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: scheduleService.deleteSchedule,
    onSuccess: () => {
      showAlert('Schedule deleted successfully!', 'success');
      queryClient.invalidateQueries(['weeklySchedule']);
    },
    onError: (error) => {
      showAlert(`Error: ${error.response?.data?.message || 'Failed to delete schedule'}`, 'error');
    }
  });

  // Merge schedules mutation
  const mergeSchedulesMutation = useMutation({
    mutationFn: ({ sourceId, targetId, customLabel }) => 
      scheduleService.mergeSchedules(sourceId, targetId, customLabel),
    onSuccess: (data) => {
      console.log('Merge success:', data);
      showAlert('Schedules merged successfully!', 'success');
      setShowMergeModal(false);
      setMergeData({ sourceId: '', targetId: '', customLabel: '' });
      // Force refresh both queries
      queryClient.invalidateQueries(['weeklySchedule']);
      queryClient.refetchQueries(['weeklySchedule']);
    },
    onError: (error) => {
      console.error('Merge error:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to merge schedules';
      showAlert(`Error: ${errorMessage}`, 'error');
    }
  });

  // Split schedule mutation
  const splitScheduleMutation = useMutation({
    mutationFn: scheduleService.splitSchedule,
    onSuccess: () => {
      showAlert('Schedule split successfully!', 'success');
      queryClient.invalidateQueries(['weeklySchedule']);
    },
    onError: (error) => {
      showAlert(`Error: ${error.response?.data?.message || 'Failed to split schedule'}`, 'error');
    }
  });

  // Create recurring schedule mutation
  const createRecurringScheduleMutation = useMutation({
    mutationFn: async (scheduleData) => {
      if (Array.isArray(scheduleData)) {
        // Handle multiple schedules (weekly mode)
        const results = [];
        for (const schedule of scheduleData) {
          const result = await recurringScheduleService.createRecurringSchedule(schedule);
          results.push(result);
        }
        return results;
      } else {
        // Handle single schedule
        return await recurringScheduleService.createRecurringSchedule(scheduleData);
      }
    },
    onSuccess: (data) => {
      const count = Array.isArray(data) ? data.length : 1;
      showAlert(`${count} recurring schedule(s) created successfully!`, 'success');
      queryClient.invalidateQueries(['recurringSchedules']);
      queryClient.invalidateQueries(['todaysSchedule']);
      setShowCreateRecurringModal(false);
      setRecurringFormData({
        classId: '',
        sessionType: 'lecture',
        dayOfWeek: 'Monday',
        startTime: '09:00',
        endTime: '10:00',
        roomNumber: '',
        semester: 'VII',
        academicYear: '2025-26',
        semesterStartDate: '2025-08-01',
        semesterEndDate: '2025-12-15',
        description: '',
        notes: ''
      });
    },
    onError: (error) => {
      showAlert(`Error: ${error.response?.data?.message || 'Failed to create recurring schedule'}`, 'error');
    }
  });

  // Delete recurring schedule mutation
  const deleteRecurringScheduleMutation = useMutation({
    mutationFn: recurringScheduleService.deleteRecurringSchedule,
    onSuccess: () => {
      showAlert('Recurring schedule deleted successfully!', 'success');
      queryClient.invalidateQueries(['recurringSchedules']);
      queryClient.invalidateQueries(['todaysSchedule']);
    },
    onError: (error) => {
      showAlert(`Error: ${error.response?.data?.message || 'Failed to delete recurring schedule'}`, 'error');
    }
  });

  // Create weekly from recurring schedule mutation
  const createWeeklyFromRecurringMutation = useMutation({
    mutationFn: recurringScheduleService.createWeeklyFromRecurring,
    onSuccess: (data) => {
      showAlert(
        'Weekly Schedule Created',
        `Weekly schedule template created successfully from "${data.sourceRecurringSchedule.title}"`,
        'success'
      );
      // Optionally refresh weekly schedules
      queryClient.invalidateQueries(['weeklySchedule']);
    },
    onError: (error) => {
      showAlert(
        'Creation Failed',
        error.response?.data?.message || 'Failed to create weekly schedule',
        'error'
      );
    }
  });

  // Fetch all time slots (including breaks for display)
  const { data: allTimeSlots = [], isLoading: allTimeSlotsLoading } = useQuery({
    queryKey: ['allTimeSlots'],
    queryFn: timeSlotService.getTimeSlots,
    onError: (error) => {
      console.error('All time slots loading error:', error);
    }
  });

  // Convert API time slots to display format with fallback
  const timeSlots = allTimeSlots?.length > 0 ? allTimeSlots.map(slot => ({
    id: slot._id,
    start: slot.startTime,
    end: slot.endTime,
    label: `${slot.startTime}-${slot.endTime}${slot.type === 'break' ? ` (${slot.name})` : ''}`,
    type: slot.type === 'break' ? 'break' : 'class',
    name: slot.name,
    duration: slot.duration
  })) : [
    // Fallback time slots if API doesn't return any
    { id: 'slot-1', start: '09:00', end: '10:00', label: '09:00-10:00', type: 'class', name: 'Period 1' },
    { id: 'slot-2', start: '10:00', end: '11:00', label: '10:00-11:00', type: 'class', name: 'Period 2' },
    { id: 'break-1', start: '11:00', end: '11:15', label: '11:00-11:15 (Break)', type: 'break', name: 'Refreshment Break', duration: 15 },
    { id: 'slot-3', start: '11:15', end: '12:15', label: '11:15-12:15', type: 'class', name: 'Period 3' },
    { id: 'slot-4', start: '12:15', end: '13:15', label: '12:15-13:15', type: 'class', name: 'Period 4' },
    { id: 'break-2', start: '13:15', end: '14:00', label: '13:15-14:00 (Lunch)', type: 'break', name: 'Lunch Break', duration: 45 },
    { id: 'slot-5', start: '14:00', end: '15:00', label: '14:00-15:00', type: 'class', name: 'Period 5' },
    { id: 'slot-6', start: '15:00', end: '16:00', label: '15:00-16:00', type: 'class', name: 'Period 6' },
    { id: 'slot-7', start: '16:15', end: '17:15', label: '16:15-17:15', type: 'class', name: 'Period 7' }
  ];

  const daysOfWeek = scheduleService.getDaysOfWeek() || [
    { id: 'Monday', label: 'Monday', short: 'Mon' },
    { id: 'Tuesday', label: 'Tuesday', short: 'Tue' },
    { id: 'Wednesday', label: 'Wednesday', short: 'Wed' },
    { id: 'Thursday', label: 'Thursday', short: 'Thu' },
    { id: 'Friday', label: 'Friday', short: 'Fri' },
    { id: 'Saturday', label: 'Saturday', short: 'Sat' }
  ];

  // Helper functions for predefined options  
  const getAvailableRooms = () => [
    { id: 1, roomNumber: 'C-201', building: 'C Block', type: 'classroom' },
    { id: 2, roomNumber: 'C-202', building: 'C Block', type: 'classroom' },
    { id: 3, roomNumber: 'C-203', building: 'C Block', type: 'classroom' },
    { id: 4, roomNumber: 'C-204', building: 'C Block', type: 'classroom' },
    { id: 5, roomNumber: 'E-201', building: 'E Block', type: 'lab' },
    { id: 6, roomNumber: 'E-202', building: 'E Block', type: 'lab' },
    { id: 7, roomNumber: 'A-301', building: 'A Block', type: 'classroom' },
  ];

  const handleCreateSchedule = (e) => {
    e.preventDefault();
    
    // Check if either a room is selected OR custom room is entered
    const hasRoom = formData.roomId || formData.customRoom.trim();
    
    if (!formData.classId || !formData.dayOfWeek || !formData.timeSlotId || !hasRoom) {
      showAlert('Please fill in all required fields', 'warning');
      return;
    }

    // Get the selected class and time slot data
    const selectedClass = classesData?.find(cls => cls._id === formData.classId);
    const selectedTimeSlot = availableTimeSlots.find(slot => slot._id === formData.timeSlotId);
    const availableRooms = getAvailableRooms();
    const selectedRoom = availableRooms.find(room => room.id.toString() === formData.roomId);
    
    // Use custom room if provided, otherwise use selected room
    const roomNumber = formData.customRoom.trim() || selectedRoom?.roomNumber;
    
    const scheduleData = {
      classId: formData.classId,
      dayOfWeek: formData.dayOfWeek,
      startTime: selectedTimeSlot?.startTime,
      endTime: selectedTimeSlot?.endTime,
      roomNumber: roomNumber,
      sessionType: selectedTimeSlot?.type || 'lecture',
      semester: selectedClass?.semester || '1',
      academicYear: selectedClass?.classYear ? `${selectedClass.classYear}` : '1'
    };

    createScheduleMutation.mutate(scheduleData);
  };

  const handleSlotClick = (day, timeSlot) => {
    // Prevent scheduling during break times
    if (timeSlot.type === 'break') {
      showAlert('Cannot schedule classes during break time', 'warning');
      return;
    }
    
    // Find the matching time slot ID from our available time slots
    const matchingTimeSlot = availableTimeSlots.find(slot => 
      slot.startTime === timeSlot.start && slot.endTime === timeSlot.end
    );
    
    setSelectedSlot({ day, timeSlot });
    setFormData({
      ...formData,
      dayOfWeek: day.id,
      timeSlotId: matchingTimeSlot ? matchingTimeSlot._id : '',
      roomId: '',
      customRoom: ''
    });
    setShowCreateModal(true);
  };

  const handleDeleteSchedule = (scheduleId) => {
    showConfirm(
      'Are you sure you want to delete this schedule?',
      () => deleteScheduleMutation.mutate(scheduleId),
      {
        title: 'Delete Schedule',
        type: 'danger',
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    );
  };

  const handleSplitSchedule = (scheduleId) => {
    showConfirm(
      'Are you sure you want to split this merged schedule back into individual slots?',
      () => splitScheduleMutation.mutate(scheduleId),
      {
        title: 'Split Schedule',
        type: 'warning',
        confirmText: 'Split',
        cancelText: 'Cancel'
      }
    );
  };

  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;

    // If no destination or dropped in the same place, do nothing
    if (!destination || 
        (source.droppableId === destination.droppableId && source.index === destination.index)) {
      return;
    }

    // Extract day and timeSlot from droppableId (format: "day-startTime_endTime")
    const [sourceDay, sourceTimeRange] = source.droppableId.split('-');
    const [destDay, destTimeRange] = destination.droppableId.split('-');
    
    const [sourceStart, sourceEnd] = sourceTimeRange.split('_');
    const [destStart, destEnd] = destTimeRange.split('_');

    // Only allow merging within the same day
    if (sourceDay !== destDay) {
      showAlert('Can only merge schedules within the same day', 'warning');
      return;
    }

    // Define valid 2-hour continuous blocks
    const validMergeCombinations = [
      // 9:00-11:00 (1st + 2nd period)
      { slots: [{ start: '09:00', end: '10:00' }, { start: '10:00', end: '11:00' }], label: '9:00-11:00 Lab Session' },
      // 11:15-13:15 (3rd + 4th period)
      { slots: [{ start: '11:15', end: '12:15' }, { start: '12:15', end: '13:15' }], label: '11:15-13:15 Lab Session' },
      // 14:00-16:00 (5th + 6th period)
      { slots: [{ start: '14:00', end: '15:00' }, { start: '15:00', end: '16:00' }], label: '14:00-16:00 Lab Session' }
    ];

    // Check if the source and destination times form a valid merge combination
    let validCombination = null;
    for (const combination of validMergeCombinations) {
      const [slot1, slot2] = combination.slots;
      
      // Check if source and dest match this combination (in either order)
      const isValidOrder1 = (sourceStart === slot1.start && sourceEnd === slot1.end && 
                             destStart === slot2.start && destEnd === slot2.end);
      const isValidOrder2 = (sourceStart === slot2.start && sourceEnd === slot2.end && 
                             destStart === slot1.start && destEnd === slot1.end);
      
      if (isValidOrder1 || isValidOrder2) {
        validCombination = combination;
        break;
      }
    }

    if (!validCombination) {
      showAlert('Can only merge schedules for continuous 2-hour blocks:\n• 9:00-11:00 (1st + 2nd period)\n• 11:15-13:15 (3rd + 4th period)\n• 14:00-16:00 (5th + 6th period)', 'warning');
      return;
    }

    // Get the source schedule (must exist since we're dragging it)
    const sourceSchedule = getScheduleForSlot(sourceDay, { start: sourceStart, end: sourceEnd });
    
    if (!sourceSchedule) {
      showAlert('Source schedule not found', 'error');
      return;
    }

    // Check if destination has a schedule - if not, we can't merge
    const destSchedule = getScheduleForSlot(destDay, { start: destStart, end: destEnd });
    
    if (!destSchedule) {
      showAlert('Cannot merge with empty time slot. Please create a schedule in the destination slot first, then drag to merge.', 'warning');
      return;
    }

    // Check if schedules are for the same class
    const sourceClassId = sourceSchedule.classId?._id || sourceSchedule.classId;
    const destClassId = destSchedule.classId?._id || destSchedule.classId;
    
    if (sourceClassId !== destClassId) {
      showAlert('Can only merge schedules for the same class', 'warning');
      return;
    }

    // Set up merge data and show modal with suggested label
    setMergeData({
      sourceId: sourceSchedule._id,
      targetId: destSchedule._id,
      customLabel: validCombination.label
    });
    setShowMergeModal(true);
  };

  const handleMergeSubmit = (e) => {
    e.preventDefault();
    if (!mergeData.sourceId || !mergeData.targetId || !mergeData.customLabel) {
      showAlert('Please fill in all fields', 'warning');
      return;
    }
    mergeSchedulesMutation.mutate(mergeData);
  };

  const getScheduleForSlot = (dayId, timeSlot) => {
    if (!weeklySchedule?.data?.weeklySchedule) return null;
    
    const daySchedules = weeklySchedule.data.weeklySchedule[dayId];
    if (!daySchedules || !Array.isArray(daySchedules)) return null;
    
    // First check for exact time match (regular schedules)
    const exactMatch = daySchedules.find(schedule => 
      schedule.startTime === timeSlot.start && 
      schedule.endTime === timeSlot.end
    );
    
    if (exactMatch) return exactMatch;
    
    // Check for merged schedules that span this time slot
    const mergedMatch = daySchedules.find(schedule => {
      if (!schedule.isMerged) return false;
      
      // Convert times to minutes for comparison
      const slotStart = timeToMinutes(timeSlot.start);
      const slotEnd = timeToMinutes(timeSlot.end);
      const scheduleStart = timeToMinutes(schedule.startTime);
      const scheduleEnd = timeToMinutes(schedule.endTime);
      
      // Check if this time slot is within the merged schedule's range
      return slotStart >= scheduleStart && slotEnd <= scheduleEnd;
    });
    
    return mergedMatch || null;
  };

  // Helper function to convert HH:mm to minutes
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Get valid merge time slots for visual hints
  const getValidMergeSlots = () => {
    return [
      // 9:00-11:00 block
      { start: '09:00', end: '10:00', pair: '10:00-11:00', block: '9:00-11:00' },
      { start: '10:00', end: '11:00', pair: '09:00-10:00', block: '9:00-11:00' },
      // 11:15-13:15 block  
      { start: '11:15', end: '12:15', pair: '12:15-13:15', block: '11:15-13:15' },
      { start: '12:15', end: '13:15', pair: '11:15-12:15', block: '11:15-13:15' },
      // 14:00-16:00 block
      { start: '14:00', end: '15:00', pair: '15:00-16:00', block: '14:00-16:00' },
      { start: '15:00', end: '16:00', pair: '14:00-15:00', block: '14:00-16:00' }
    ];
  };

  // Only show loading when critical data is loading
  if ((isLoading && !timeSlots.length) || allTimeSlotsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-8">
        <p>Error loading schedule: {error.response?.data?.message || error.message}</p>
        <button 
          onClick={() => queryClient.invalidateQueries(['weeklySchedule'])}
          className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }



  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Schedule Management</h1>
            <p className="text-gray-600 mt-1">
              {activeTab === 'weekly' 
                ? `Schedule for week of ${selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'selected date'}`
                : 'Manage your recurring schedules for the entire semester'
              }
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-4">
            {activeTab === 'semester' && (
              <button
                onClick={() => setShowCreateRecurringModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
              >
                <span>➕</span>
                <span>Create Recurring Schedule</span>
              </button>
            )}
          </div>
        </div>

        {/* Date selector for weekly tab */}
        {activeTab === 'weekly' && (
          <div className="flex justify-between items-center">
            <div></div>
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Week {selectedWeek ? selectedWeek.split('-W')[1] : ''} of {selectedWeek ? selectedWeek.split('-W')[0] : ''}
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors mt-6"
              >
                Add Schedule
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'weekly', name: 'Weekly Schedule', icon: '📅' },
            { id: 'semester', name: 'Semester Schedule', icon: '📋' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon} {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'weekly' && (
        <>


          {/* Timetable Grid */}
          <DragDropContext onDragEnd={handleDragEnd}>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Time
                  </th>
                  {daysOfWeek.map((day) => (
                    <th key={day.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {timeSlots && timeSlots.length > 0 ? timeSlots.map((timeSlot) => (
                  <tr key={timeSlot.id} className={`hover:bg-gray-50 ${timeSlot.type === 'break' ? 'bg-gray-100' : ''}`}>
                    <td className={`px-4 py-6 whitespace-nowrap text-sm font-medium ${timeSlot.type === 'break' ? 'text-gray-600 bg-gray-200' : 'text-gray-900 bg-gray-50'}`}>
                      {timeSlot.label}
                    </td>
                    {timeSlot.type === 'break' ? (
                      // Render break row spanning all days
                      <td colSpan={daysOfWeek.length} className="px-2 py-2 text-center">
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 h-20 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-sm font-semibold text-orange-800">
                              {timeSlot.name && timeSlot.name.includes('Break') ? `🧘 ${timeSlot.name}` : `🍽️ ${timeSlot.name || 'Break'}`}
                            </div>
                            <div className="text-xs text-orange-600">
                              {timeSlot.duration || 15} minutes
                            </div>
                            {timeSlot.name && timeSlot.name.includes('Refreshment') && (
                              <div className="text-xs text-orange-500 mt-1">
                                Time to freshen up
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    ) : (
                      // Render normal class slots for each day with drag and drop
                      daysOfWeek.map((day) => {
                        const schedule = getScheduleForSlot(day.id, timeSlot);
                        const droppableId = `${day.id}-${timeSlot.start}_${timeSlot.end}`;
                        
                        return (
                          <td key={day.id} className="px-2 py-2 text-center relative">
                            <Droppable droppableId={droppableId}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`min-h-[80px] ${snapshot.isDraggedOver ? 'bg-blue-50 border-2 border-blue-300 border-dashed' : ''}`}
                                >
                                  {schedule ? (
                                    <Draggable draggableId={schedule._id} index={0}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={`rounded-lg p-3 flex flex-col justify-between transition-colors group cursor-move ${
                                            snapshot.isDragging ? 'shadow-lg rotate-3 bg-indigo-200' : 'hover:bg-indigo-200'
                                          } ${
                                            schedule.isMerged 
                                              ? 'bg-purple-100 border-purple-200 min-h-[100px]' 
                                              : 'bg-indigo-100 border border-indigo-200 min-h-[80px]'
                                          }`}
                                        >
                                          <div>
                                            <div className="text-sm font-semibold text-indigo-900">
                                              {schedule.customLabel || schedule.classId?.subjectCode || schedule.class?.subjectCode || schedule.subjectCode || 'No Subject'}
                                              {schedule.isMerged && <span className="text-xs text-purple-600 ml-1">🔗</span>}
                                            </div>
                                            <div className="text-xs text-indigo-700">
                                              {schedule.classId?.subjectName || schedule.class?.subjectName || schedule.subjectName || 'Subject Name Not Available'}
                                            </div>
                                            <div className="text-xs text-indigo-600">
                                              {(schedule.classId?.semester || schedule.class?.semester || schedule.semester) ? 
                                                `Sem ${schedule.classId?.semester || schedule.class?.semester || schedule.semester}` : 'Semester N/A'}
                                              {(schedule.classId?.division || schedule.class?.division || schedule.division) && 
                                                ` | ${schedule.classId?.division || schedule.class?.division || schedule.division}`}
                                            </div>
                                            {(schedule.roomNumber || schedule.location) && (
                                              <div className="text-xs text-indigo-500">
                                                📍 {schedule.roomNumber || 
                                                     (typeof schedule.location === 'string' 
                                                       ? schedule.location 
                                                       : 'Room Available')}
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex justify-between items-center">
                                            <div className="text-xs text-gray-500">
                                              {schedule.isMerged ? '✔ Merged' : '↔ Drag to merge'}
                                            </div>
                                            <div className="flex space-x-2">
                                              {schedule.isMerged && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSplitSchedule(schedule._id);
                                                  }}
                                                  className="bg-yellow-500 text-white rounded-md px-3 py-1 text-xs font-medium hover:bg-yellow-600 transition-colors flex items-center space-x-1 shadow-sm"
                                                  title="Split merged schedule"
                                                >
                                                  <span>✂</span>
                                                  <span>Split</span>
                                                </button>
                                              )}
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteSchedule(schedule._id);
                                                }}
                                                className="bg-red-500 text-white rounded-md px-3 py-1 text-xs font-medium hover:bg-red-600 transition-colors flex items-center space-x-1 shadow-sm"
                                                title="Delete schedule"
                                              >
                                                <span>×</span>
                                                <span>Delete</span>
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  ) : (
                                    <button
                                      onClick={() => handleSlotClick(day, timeSlot)}
                                      className="w-full h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
                                    >
                                      <span className="text-2xl">+</span>
                                    </button>
                                  )}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </td>
                        );
                      })
                    )}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={daysOfWeek.length + 1} className="px-4 py-8 text-center text-gray-500">
                      No time slots available. Loading...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DragDropContext>

          {/* Create Schedule Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Add Schedule
                    {selectedSlot && (
                      <span className="block text-sm font-normal text-gray-600 mt-1">
                        📅 {selectedSlot.day.label} | ⏰ {selectedSlot.timeSlot.label}
                      </span>
                    )}
                  </h3>
                  <form onSubmit={handleCreateSchedule} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                      <select
                        value={formData.classId}
                        onChange={(e) => setFormData({...formData, classId: e.target.value})}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      >
                        <option value="">
                          {classesLoading ? 'Loading classes...' : 'Select a class'}
                        </option>
                        {classesError && (
                          <option value="" disabled>Error loading classes</option>
                        )}
                        {classesData && (
                          // Handle different possible data structures
                          (Array.isArray(classesData) ? classesData : classesData.data || classesData.classes || [])?.map((cls) => (
                            <option key={cls._id} value={cls._id}>
                              {cls.subjectCode || cls.code} - {cls.subjectName || cls.name || cls.subject} 
                              {cls.semester && ` | Sem ${cls.semester}`}
                              {cls.classYear && ` | ${cls.classYear}`}
                              {cls.division && ` | Div ${cls.division}`}
                            </option>
                          ))
                        )}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Classes from all semesters and years will be shown
                        {classesError && <span className="text-red-500"> - Error: {classesError.message}</span>}
                        {classesData && <span className="text-green-500"> - {(Array.isArray(classesData) ? classesData : classesData.data || classesData.classes || [])?.length || 0} classes found</span>}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                      <select
                        value={formData.dayOfWeek}
                        onChange={(e) => setFormData({...formData, dayOfWeek: e.target.value})}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      >
                        <option value="">Select a day</option>
                        {daysOfWeek.map((day) => (
                          <option key={day.id} value={day.id}>{day.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Time Slot</label>
                      <select
                        value={formData.timeSlotId}
                        onChange={(e) => setFormData({...formData, timeSlotId: e.target.value})}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      >
                        <option value="">Select a time slot</option>
                        {availableTimeSlots.map((slot) => (
                          <option key={slot._id} value={slot._id}>
                            {slot.name} ({slot.startTime} - {slot.endTime}) - {slot.type}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedSlot ? (
                          <span className="text-green-600">✅ Auto-selected from schedule grid</span>
                        ) : (
                          <span>💡 For 2-hour lab sessions, create individual periods first, then drag one to another to merge into 2-hour blocks: 9:00-11:00, 11:15-13:15, or 14:00-16:00</span>
                        )}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                      <select
                        value={formData.roomId}
                        onChange={(e) => {
                          setFormData({...formData, roomId: e.target.value, customRoom: ''});
                        }}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 mb-2"
                      >
                        <option value="">Select a predefined room</option>
                        {getAvailableRooms().map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.roomNumber} - {room.building} ({room.type})
                          </option>
                        ))}
                      </select>
                      
                      <div className="text-sm text-gray-500 mb-2 text-center">OR</div>
                      
                      <input
                        type="text"
                        value={formData.customRoom}
                        onChange={(e) => {
                          setFormData({...formData, customRoom: e.target.value, roomId: ''});
                        }}
                        placeholder="Enter custom room (e.g., C-205, Lab-3)"
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Choose from dropdown or enter a custom room number
                      </p>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={createScheduleMutation.isLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {createScheduleMutation.isLoading ? 'Creating...' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Merge Schedules Modal */}
          {showMergeModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    🔗 Merge Schedules
                  </h3>
                  <div className="text-sm text-gray-600 mb-4">
                    You're about to merge two consecutive time slots into one 2-hour session.
                  </div>
                  
                  <form onSubmit={handleMergeSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Session Label
                      </label>
                      <input
                        type="text"
                        value={mergeData.customLabel}
                        onChange={(e) => setMergeData({...mergeData, customLabel: e.target.value})}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="e.g., Lab Session, Extended Lecture"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This label will be displayed for the merged session
                      </p>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-md">
                      <div className="text-sm font-medium text-blue-700 mb-2">Valid 2-Hour Merge Blocks:</div>
                      <div className="text-xs text-blue-600">
                        • 9:00-11:00 (1st + 2nd period)<br/>
                        • 11:15-13:15 (3rd + 4th period)<br/>
                        • 14:00-16:00 (5th + 6th period)
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-md">
                      <div className="text-sm font-medium text-gray-700 mb-2">What happens:</div>
                      <div className="text-sm text-gray-600">
                        • Two separate time slots will be combined<br/>
                        • Session type will be set to "Lab"<br/>
                        • Custom label: "{mergeData.customLabel}"<br/>
                        • You can split it back later if needed
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMergeModal(false);
                          setMergeData({ sourceId: '', targetId: '', customLabel: '' });
                        }}
                        className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-200 transition-colors font-medium border border-gray-300"
                      >
                        ✕ Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={mergeSchedulesMutation.isLoading}
                        className="flex-1 bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium shadow-sm"
                      >
                        {mergeSchedulesMutation.isLoading ? 'Merging...' : '🔗 Merge Sessions'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'semester' && (
        <SemesterScheduleContent 
          recurringSchedules={recurringSchedules}
          todaysSchedule={todaysSchedule}
          recurringLoading={recurringLoading}
          deleteRecurringScheduleMutation={deleteRecurringScheduleMutation}
          showAlert={showAlert}
          showConfirm={showConfirm}
        />
      )}

      {/* Recurring Schedule Create Modal */}
      {showCreateRecurringModal && (
        <CreateRecurringScheduleModal
          isOpen={showCreateRecurringModal}
          onClose={() => setShowCreateRecurringModal(false)}
          onSubmit={(data) => createRecurringScheduleMutation.mutate(data)}
          classes={classesData}
          isLoading={createRecurringScheduleMutation.isLoading}
          formData={recurringFormData}
          setFormData={setRecurringFormData}
          showAlert={showAlert}
          showConfirm={showConfirm}
          existingSchedules={recurringSchedules?.data || []}
        />
      )}

      {/* Custom Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={closeAlert}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      {/* Custom Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
      />
    </div>
  );
};

// Semester Schedule Content Component
const SemesterScheduleContent = ({ 
  recurringSchedules, 
  todaysSchedule, 
  recurringLoading, 
  deleteRecurringScheduleMutation,
  showAlert,
  showConfirm 
}) => {
  const schedulesArray = recurringSchedules?.data || [];
  const todaysClasses = todaysSchedule?.data || [];

  const handleDeleteSchedule = (schedule) => {
    showConfirm(
      `Are you sure you want to delete the recurring schedule for "${schedule.title}"? This will cancel all future classes.`,
      () => deleteRecurringScheduleMutation.mutate(schedule._id),
      {
        title: 'Delete Recurring Schedule',
        type: 'danger',
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    );
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeSlots = [
    { id: '09:00-10:00', start: '09:00', end: '10:00', label: '9:00 AM - 10:00 AM' },
    { id: '10:00-11:00', start: '10:00', end: '11:00', label: '10:00 AM - 11:00 AM' },
    { id: '11:15-12:15', start: '11:15', end: '12:15', label: '11:15 AM - 12:15 PM' },
    { id: '12:15-13:15', start: '12:15', end: '13:15', label: '12:15 PM - 1:15 PM' },
    { id: '14:00-15:00', start: '14:00', end: '15:00', label: '2:00 PM - 3:00 PM' },
    { id: '15:00-16:00', start: '15:00', end: '16:00', label: '3:00 PM - 4:00 PM' },
    { id: '16:15-17:15', start: '16:15', end: '17:15', label: '4:15 PM - 5:15 PM' }
  ];

  // Helper function to check if a time slot is the first slot of a merged lab session
  const isFirstSlotOfMergedLab = (schedule, day, timeSlot) => {
    if (!schedule || schedule.sessionType !== 'lab') {
      return true; // Not a lab, show normally
    }
    
    // If it's a 2-hour lab, only show in the first time slot
    const scheduleStart = schedule.startTime;
    const slotStart = timeSlot.start;
    
    return scheduleStart === slotStart;
  };
  
  // Helper function to get the span of a merged lab session
  const getLabSpanInfo = (schedule, day, timeSlot) => {
    if (!schedule || schedule.sessionType !== 'lab') {
      return { shouldShow: true, rowSpan: 1 };
    }
    
    const scheduleStart = schedule.startTime;
    const scheduleEnd = schedule.endTime;
    const slotStart = timeSlot.start;
    
    // Check if this is a 2-hour lab session
    const isFirstSlot = scheduleStart === slotStart;
    
    if (isFirstSlot) {
      // Calculate how many slots this lab spans
      const startSlotIndex = timeSlots.findIndex(slot => slot.start === scheduleStart);
      const endSlotIndex = timeSlots.findIndex(slot => slot.end === scheduleEnd);
      const spanCount = endSlotIndex - startSlotIndex + 1;
      
      return { shouldShow: true, rowSpan: spanCount > 1 ? spanCount : 1 };
    } else {
      // This is a subsequent slot of a merged lab, don't show
      return { shouldShow: false, rowSpan: 1 };
    }
  };
  const getScheduleForSlot = (day, timeSlot) => {
    // First check for exact time match
    const exactMatch = schedulesArray.find(schedule => 
      schedule.dayOfWeek === day && 
      schedule.startTime === timeSlot.start && 
      schedule.endTime === timeSlot.end
    );
    
    if (exactMatch) {
      return exactMatch;
    }
    
    // Check for merged lab sessions that span multiple time slots
    const mergedLabMatch = schedulesArray.find(schedule => {
      // Check if this time slot is within a merged lab session
      if (schedule.sessionType === 'lab' && schedule.dayOfWeek === day) {
        const scheduleStart = schedule.startTime;
        const scheduleEnd = schedule.endTime;
        const slotStart = timeSlot.start;
        const slotEnd = timeSlot.end;
        
        // Check if this slot is within the merged lab time range
        return slotStart >= scheduleStart && slotEnd <= scheduleEnd;
      }
      return false;
    });
    
    return mergedLabMatch;
  };

  if (recurringLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Today's Classes Summary */}
      {todaysClasses.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">📋 Today's Classes ({todaysClasses.length})</h3>
          <div className="flex flex-wrap gap-2">
            {todaysClasses.map((classInstance, index) => (
              <span
                key={classInstance._id}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
              >
                {classInstance.classId.subjectCode} • {classInstance.startTime}-{classInstance.endTime}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Semester Schedule Grid - Same style as Weekly Schedule */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Semester Schedule Overview</h2>
          <p className="text-gray-600 mt-1">Your recurring classes for the entire semester</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Time
                </th>
                {days.map((day) => (
                  <th key={day} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {timeSlots.map((timeSlot) => (
                <tr key={timeSlot.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50">
                    <div className="text-center">
                      <div className="font-semibold">{timeSlot.start}</div>
                      <div className="text-xs text-gray-500">{timeSlot.end}</div>
                    </div>
                  </td>
                  {days.map((day) => {
                    const schedule = getScheduleForSlot(day, timeSlot);
                    const spanInfo = getLabSpanInfo(schedule, day, timeSlot);
                    
                    // Don't render cell if it's part of a merged lab but not the first slot
                    if (!spanInfo.shouldShow) {
                      return null;
                    }
                    
                    return (
                      <td 
                        key={`${day}-${timeSlot.id}`} 
                        className="px-2 py-2 relative"
                        rowSpan={spanInfo.rowSpan > 1 ? spanInfo.rowSpan : 1}
                      >
                        <div className={`min-h-[80px] border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors ${
                          spanInfo.rowSpan > 1 ? 'bg-green-50 border-green-200' : ''
                        }`}>
                          {schedule ? (
                            <div className="p-3 h-full">
                              <div className="flex flex-col h-full">
                                <div className="flex-1">
                                  <div className="font-semibold text-sm text-gray-900 mb-1">
                                    {schedule.classId.subjectCode}
                                  </div>
                                  <div className="text-xs text-gray-600 mb-1">
                                    {schedule.classId.subjectName}
                                  </div>
                                  <div className="text-xs text-gray-500 mb-2">
                                    📍 {schedule.roomNumber}
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                      schedule.sessionType === 'lecture' ? 'bg-blue-100 text-blue-800' :
                                      schedule.sessionType === 'lab' ? 'bg-green-100 text-green-800' :
                                      schedule.sessionType === 'tutorial' ? 'bg-purple-100 text-purple-800' :
                                      'bg-orange-100 text-orange-800'
                                    }`}>
                                      {schedule.sessionType.toUpperCase()}
                                    </span>
                                    {spanInfo.rowSpan > 1 && (
                                      <span className="text-xs text-green-600 font-medium">
                                        {schedule.startTime} - {schedule.endTime}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <button
                                    onClick={() => handleDeleteSchedule(schedule)}
                                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                                    disabled={deleteRecurringScheduleMutation.isLoading}
                                  >
                                    🗑️ Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center text-gray-300">
                              <span className="text-lg">—</span>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {schedulesArray.length === 0 && (
          <div className="text-center py-12 bg-gray-50">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No recurring schedules</h3>
            <p className="text-gray-500 mb-4">Create your first recurring schedule to get started</p>
          </div>
        )}
      </div>

      {/* Schedule Statistics */}
      {schedulesArray.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">📊 Schedule Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{schedulesArray.length}</div>
              <div className="text-sm text-gray-600">Total Classes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {schedulesArray.filter(s => s.sessionType === 'lecture').length}
              </div>
              <div className="text-sm text-gray-600">Lectures</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {schedulesArray.filter(s => s.sessionType === 'lab').length}
              </div>
              <div className="text-sm text-gray-600">Labs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {new Set(schedulesArray.map(s => s.dayOfWeek)).size}
              </div>
              <div className="text-sm text-gray-600">Active Days</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Create Recurring Schedule Modal Component
// Fixed: Added comprehensive validation to prevent "Cannot read properties of undefined (reading 'start')" errors
// - Validates timeSlot objects before accessing start/end properties
// - Validates array indices to prevent accessing undefined elements
// - Ensures timeSlot data integrity throughout the component lifecycle
const CreateRecurringScheduleModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  classes, 
  isLoading, 
  formData, 
  setFormData,
  showAlert,
  showConfirm,
  existingSchedules = []
}) => {
  const queryClient = useQueryClient(); // <-- FIX: Get queryClient instance
  const [scheduleMode, setScheduleMode] = React.useState('weekly'); // 'single' or 'weekly'
  const [weeklySchedules, setWeeklySchedules] = React.useState({});
  const [globalSettings, setGlobalSettings] = React.useState({
    semester: 'VII',
    academicYear: '2025-26',
    semesterStartDate: '2025-08-01',
    semesterEndDate: '2025-12-15'
  });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeSlots = [
    { id: '09:00-10:00', start: '09:00', end: '10:00', label: '9:00 AM - 10:00 AM' },
    { id: '10:00-11:00', start: '10:00', end: '11:00', label: '10:00 AM - 11:00 AM' },
    { id: '11:15-12:15', start: '11:15', end: '12:15', label: '11:15 AM - 12:15 PM' },
    { id: '12:15-13:15', start: '12:15', end: '13:15', label: '12:15 PM - 1:15 PM' },
    { id: '14:00-15:00', start: '14:00', end: '15:00', label: '2:00 PM - 3:00 PM' },
    { id: '15:00-16:00', start: '15:00', end: '16:00', label: '3:00 PM - 4:00 PM' },
    { id: '16:15-17:15', start: '16:15', end: '17:15', label: '4:15 PM - 5:15 PM' }
  ];

  const classesArray = Array.isArray(classes) ? classes : [];

  // Validate timeSlots array on component initialization
  React.useEffect(() => {
    const invalidSlots = timeSlots.filter(slot => !slot.id || !slot.start || !slot.end);
    if (invalidSlots.length > 0) {
      console.error('Invalid time slots detected:', invalidSlots);
      showAlert('Configuration Error', 'Some time slots have invalid data. Please refresh the page.', 'error');
    }
  }, []);

  // Function to scan and merge existing valid lab blocks
  const scanAndMergeExistingLabs = React.useCallback(() => {
    console.log('=== STARTING MERGE SCAN ===');
    console.log('Current weeklySchedules:', weeklySchedules);
    console.log('ExistingSchedules:', existingSchedules);
    
    const validLabBlocks = [
      { first: { start: '09:00', end: '10:00' }, second: { start: '10:00', end: '11:00' }, merged: { start: '09:00', end: '11:00' } },
      { first: { start: '11:15', end: '12:15' }, second: { start: '12:15', end: '13:15' }, merged: { start: '11:15', end: '13:15' } },
      { first: { start: '14:00', end: '15:00' }, second: { start: '15:00', end: '16:00' }, merged: { start: '14:00', end: '16:00' } }
    ];

    let totalMerged = 0;
    let foundExistingCandidates = [];
    
    // Check existing saved schedules first
    if (existingSchedules && existingSchedules.length > 0) {
      console.log('=== CHECKING EXISTING SCHEDULES ===');
      
      days.forEach(day => {
        validLabBlocks.forEach(block => {
          const firstSchedule = existingSchedules.find(schedule => 
            schedule.dayOfWeek === day && 
            schedule.startTime === block.first.start && 
            schedule.endTime === block.first.end &&
            (!schedule.sessionType || schedule.sessionType !== 'lab')
          );
          
          const secondSchedule = existingSchedules.find(schedule => 
            schedule.dayOfWeek === day && 
            schedule.startTime === block.second.start && 
            schedule.endTime === block.second.end &&
            (!schedule.sessionType || schedule.sessionType !== 'lab')
          );
          
          if (firstSchedule && secondSchedule) {
            const firstClassId = firstSchedule.classId?._id || firstSchedule.classId;
            const secondClassId = secondSchedule.classId?._id || secondSchedule.classId;
            
            console.log(`Found potential merge on ${day}:`, {
              first: { id: firstSchedule._id, classId: firstClassId, title: firstSchedule.title },
              second: { id: secondSchedule._id, classId: secondClassId, title: secondSchedule.title },
              sameClass: firstClassId === secondClassId
            });
            
            if (firstClassId && secondClassId && firstClassId === secondClassId) {
              foundExistingCandidates.push({
                day,
                block,
                firstSchedule,
                secondSchedule,
                className: firstSchedule.classId?.subjectName || firstSchedule.title
              });
            }
          }
        });
      });
    }
    
    // Check weekly schedules for merge opportunities
    const weeklyKeys = Object.keys(weeklySchedules);
    if (weeklyKeys.length > 0) {
      console.log('=== CHECKING WEEKLY SCHEDULES ===');
      
      setWeeklySchedules(prevSchedules => {
        const updated = { ...prevSchedules };
        let hasChanges = false;

        days.forEach(day => {
          validLabBlocks.forEach(block => {
            const firstSlotId = timeSlots.find(slot => slot.start === block.first.start && slot.end === block.first.end)?.id;
            const secondSlotId = timeSlots.find(slot => slot.start === block.second.start && slot.end === block.second.end)?.id;
            
            if (firstSlotId && secondSlotId) {
              const firstCellKey = `${day}-${firstSlotId}`;
              const secondCellKey = `${day}-${secondSlotId}`;
              const firstSchedule = updated[firstCellKey];
              const secondSchedule = updated[secondCellKey];
              
              if (firstSchedule && secondSchedule && 
                  firstSchedule.classId && secondSchedule.classId &&
                  firstSchedule.classId === secondSchedule.classId &&
                  !firstSchedule.isMerged && !secondSchedule.isMerged) {
                
                console.log(`Merging weekly schedules on ${day}: ${block.first.start}-${block.second.end}`);
                
                updated[firstCellKey] = {
                  ...firstSchedule,
                  sessionType: 'lab',
                  isMerged: true,
                  mergedWith: secondCellKey,
                  timeSlot: {
                    ...firstSchedule.timeSlot,
                    end: block.merged.end,
                    label: `${block.merged.start} - ${block.merged.end} (Lab Session)`
                  }
                };
                
                delete updated[secondCellKey];
                hasChanges = true;
                totalMerged++;
              }
            }
          });
        });
        
        return hasChanges ? updated : prevSchedules;
      });
    }
    
    // Handle results
    console.log('=== MERGE RESULTS ===');
    console.log('Existing candidates found:', foundExistingCandidates.length);
    console.log('Weekly schedules merged:', totalMerged);
    
    if (foundExistingCandidates.length > 0) {
      const mergeList = foundExistingCandidates.map(candidate => 
        `• ${candidate.day}: ${candidate.className} (${candidate.block.merged.start}-${candidate.block.merged.end})`
      ).join('\n');
      
      showAlert(
        'Merge Candidates Found',
        `Found ${foundExistingCandidates.length} existing consecutive session(s) that can be merged into lab blocks:

${mergeList}

To merge existing schedules, you'll need to delete the individual sessions and recreate them as 2-hour lab sessions.`,
        'info'
      );
    } else if (totalMerged === 0) {
      showAlert(
        'No Labs to Merge',
        'No consecutive sessions with the same subject were found in valid 2-hour lab time blocks (9:00-11:00, 11:15-13:15, 14:00-16:00).\n\nMake sure you have consecutive 1-hour sessions for the same subject in these time ranges.',
        'info'
      );
    }
    
    if (totalMerged > 0) {
      showAlert(
        'Weekly Schedules Merged',
        `Successfully merged ${totalMerged} consecutive session(s) into 2-hour lab blocks in your weekly schedule.`,
        'success'
      );
    }
  }, []); // Remove all dependencies to avoid stale closure issues

  // Function to actually merge existing lab sessions via backend API
  const mergeExistingLabs = React.useCallback(async () => {
    console.log('=== STARTING ACTUAL MERGE PROCESS ===');
    console.log('Current existingSchedules:', existingSchedules);
    
    const validLabBlocks = [
      { first: { start: '09:00', end: '10:00' }, second: { start: '10:00', end: '11:00' }, merged: { start: '09:00', end: '11:00' } },
      { first: { start: '11:15', end: '12:15' }, second: { start: '12:15', end: '13:15' }, merged: { start: '11:15', end: '13:15' } },
      { first: { start: '14:00', end: '15:00' }, second: { start: '15:00', end: '16:00' }, merged: { start: '14:00', end: '16:00' } }
    ];

    let mergePromises = [];
    let foundCandidates = [];
    
    // Check existing saved schedules for merge candidates
    if (existingSchedules && existingSchedules.length > 0) {
      console.log('=== CHECKING EXISTING SCHEDULES FOR MERGE ===');
      
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      days.forEach(day => {
        validLabBlocks.forEach(block => {
          const firstSchedule = existingSchedules.find(schedule => 
            schedule.dayOfWeek === day && 
            schedule.startTime === block.first.start && 
            schedule.endTime === block.first.end &&
            schedule.sessionType !== 'lab'
          );
          
          const secondSchedule = existingSchedules.find(schedule => 
            schedule.dayOfWeek === day && 
            schedule.startTime === block.second.start && 
            schedule.endTime === block.second.end &&
            schedule.sessionType !== 'lab'
          );
          
          if (firstSchedule && secondSchedule) {
            const firstClassId = firstSchedule.classId?._id || firstSchedule.classId;
            const secondClassId = secondSchedule.classId?._id || secondSchedule.classId;
            
            console.log(`Found merge candidate on ${day}:`, {
              first: { id: firstSchedule._id, classId: firstClassId, title: firstSchedule.title },
              second: { id: secondSchedule._id, classId: secondClassId, title: secondSchedule.title },
              sameClass: firstClassId === secondClassId
            });
            
            if (firstClassId && secondClassId && firstClassId === secondClassId) {
              foundCandidates.push({
                day,
                block,
                firstSchedule,
                secondSchedule,
                className: firstSchedule.classId?.subjectName || firstSchedule.title
              });
              
              // Prepare merge API call
              const mergePromise = recurringScheduleService.mergeLabSessions(
                [firstSchedule._id, secondSchedule._id],
                `${firstSchedule.classId?.subjectCode || 'LAB'} - ${block.merged.start}-${block.merged.end} Lab Session`
              );
              
              mergePromises.push(mergePromise);
            }
          }
        });
      });
    }
    
    if (foundCandidates.length === 0) {
      showAlert(
        'No Labs to Merge',
        'No consecutive sessions with the same subject were found in valid 2-hour lab time blocks (9:00-11:00, 11:15-13:15, 14:00-16:00).\n\nMake sure you have consecutive 1-hour sessions for the same subject in these time ranges.',
        'info'
      );
      return;
    }
    
    try {
      // Show confirmation dialog
      const candidateList = foundCandidates.map(candidate => 
        `• ${candidate.day}: ${candidate.className} (${candidate.block.merged.start}-${candidate.block.merged.end})`
      ).join('\n');
      
      const confirmed = await new Promise((resolve) => {
        showConfirm(
          `Found ${foundCandidates.length} consecutive session(s) that can be merged into lab blocks:

${candidateList}

Do you want to merge these sessions?`,
          () => resolve(true),
          {
            title: 'Merge Lab Sessions',
            type: 'info',
            confirmText: 'Merge Labs',
            cancelText: 'Cancel',
            onCancel: () => resolve(false)
          }
        );
      });
      
      if (!confirmed) {
        return;
      }
      
      // Execute all merge operations
      console.log(`Executing ${mergePromises.length} merge operations...`);
      const results = await Promise.all(mergePromises);
      
      console.log('Merge results:', results);
      
      // Refresh the schedules
      queryClient.invalidateQueries(['recurringSchedules']);
      queryClient.invalidateQueries(['todaysSchedule']);
      
      showAlert(
        'Lab Sessions Merged',
        `Successfully merged ${foundCandidates.length} consecutive session(s) into 2-hour lab blocks.`,
        'success'
      );
      
    } catch (error) {
      console.error('Merge error:', error);
      showAlert(
        'Merge Failed',
        `Error merging lab sessions: ${error.response?.data?.message || error.message}`,
        'error'
      );
    }
  }, [existingSchedules, showAlert, showConfirm, queryClient]); // <-- FIX: Add queryClient to dependency array

  // Scan for existing labs when schedules change
  React.useEffect(() => {
    if (Object.keys(weeklySchedules).length > 0) {
      scanAndMergeExistingLabs();
    }
  }, []);

  // Check for conflicts with existing schedules
  const checkTimeConflict = (day, timeSlot) => {
    return existingSchedules.some(schedule => {
      if (schedule.dayOfWeek !== day) return false;
      
      // Parse time strings to minutes for easier comparison
      const parseTime = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      const scheduleStart = parseTime(schedule.startTime);
      const scheduleEnd = parseTime(schedule.endTime);
      const slotStart = parseTime(timeSlot.start);
      const slotEnd = parseTime(timeSlot.end);
      
      // Check if there's any overlap between the time ranges
      // Two ranges overlap if: start1 < end2 AND start2 < end1
      return scheduleStart < slotEnd && slotStart < scheduleEnd;
    });
  };

  const getConflictingSchedule = (day, timeSlot) => {
    return existingSchedules.find(schedule => {
      if (schedule.dayOfWeek !== day) return false;
      
      const parseTime = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      const scheduleStart = parseTime(schedule.startTime);
      const scheduleEnd = parseTime(schedule.endTime);
      const slotStart = parseTime(timeSlot.start);
      const slotEnd = parseTime(timeSlot.end);
      
      // Check if there's any overlap between the time ranges
      return scheduleStart < slotEnd && slotStart < scheduleEnd;
    });
  };

  const handleCellClick = (day, timeSlot) => {
    const cellKey = `${day}-${timeSlot.id}`;
    
    // Validate timeSlot object
    if (!timeSlot || !timeSlot.start || !timeSlot.end || !timeSlot.id) {
      showAlert('Invalid Time Slot', 'Time slot data is incomplete. Please refresh the page and try again.', 'error');
      return;
    }
    
    // Check for conflict with existing schedules
    if (checkTimeConflict(day, timeSlot)) {
      const conflictingSchedule = getConflictingSchedule(day, timeSlot);
      const roomInfo = conflictingSchedule.roomNumber ? ` in Room ${conflictingSchedule.roomNumber}` : '';
      const subjectInfo = conflictingSchedule.classId?.subjectCode ? ` (${conflictingSchedule.classId.subjectCode})` : '';
      showAlert(
        'Schedule Conflict',
        `You already have a class scheduled on ${day} from ${timeSlot.start} to ${timeSlot.end}${roomInfo}.

Existing Schedule: ${conflictingSchedule.title}${subjectInfo}
Session Type: ${conflictingSchedule.sessionType}

Please choose a different time slot.`,
        'warning'
      );
      return;
    }

    setWeeklySchedules(prev => {
      const current = prev[cellKey];
      if (current) {
        // Remove if already exists
        const newSchedules = { ...prev };
        delete newSchedules[cellKey];
        return newSchedules;
      } else {
        // Check if this can be merged with adjacent time slots
        const canMergeWithNext = checkCanMergeTimeSlots(day, timeSlot, prev);
        
        // Add new schedule slot with validated timeSlot
        return {
          ...prev,
          [cellKey]: {
            day,
            timeSlot: {
              id: timeSlot.id,
              start: timeSlot.start,
              end: timeSlot.end,
              label: timeSlot.label
            },
            classId: '',
            sessionType: 'lecture',
            roomNumber: '',
            description: '',
            isMerged: canMergeWithNext
          }
        };
      }
    });
  };

  const checkCanMergeTimeSlots = (day, currentTimeSlot, existingSchedules) => {
    // Validate input timeSlot
    if (!currentTimeSlot || !currentTimeSlot.id) {
      return false;
    }
    
    const currentIndex = timeSlots.findIndex(slot => slot.id === currentTimeSlot.id);
    
    if (currentIndex === -1) {
      return false;
    }
    
    // Check if next slot exists and is selected (regardless of subject)
    if (currentIndex < timeSlots.length - 1) {
      const nextSlot = timeSlots[currentIndex + 1];
      if (nextSlot && nextSlot.id) {
        const nextCellKey = `${day}-${nextSlot.id}`;
        const nextSchedule = existingSchedules[nextCellKey];
        
        if (nextSchedule) {
          return true;
        }
      }
    }
    
    // Check if previous slot exists and is selected (regardless of subject)
    if (currentIndex > 0) {
      const prevSlot = timeSlots[currentIndex - 1];
      if (prevSlot && prevSlot.id) {
        const prevCellKey = `${day}-${prevSlot.id}`;
        const prevSchedule = existingSchedules[prevCellKey];
        
        if (prevSchedule) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Check if this slot can be a lab session (either merged or manually selected)
  const canSelectLab = (cellKey, cellData) => {
    // Always allow lab selection manually
    return true;
  };

  // Check if consecutive slots can be merged into a lab
  const checkConsecutiveMerge = (day, timeSlot, schedules) => {
    // Validate input timeSlot
    if (!timeSlot || !timeSlot.id) {
      return { canMerge: false };
    }
    
    const currentIndex = timeSlots.findIndex(slot => slot.id === timeSlot.id);
    
    if (currentIndex === -1) {
      return { canMerge: false };
    }
    
    // Check if next slot exists and is selected
    if (currentIndex < timeSlots.length - 1) {
      const nextSlot = timeSlots[currentIndex + 1];
      if (nextSlot && nextSlot.id) {
        const nextCellKey = `${day}-${nextSlot.id}`;
        const nextSchedule = schedules[nextCellKey];
        
        if (nextSchedule && nextSchedule.classId) {
          return {
            canMerge: true,
            nextSlot: nextSlot,
            nextKey: nextCellKey,
            mergeType: 'forward'
          };
        }
      }
    }
    
    // Check if previous slot exists and is selected
    if (currentIndex > 0) {
      const prevSlot = timeSlots[currentIndex - 1];
      if (prevSlot && prevSlot.id) {
        const prevCellKey = `${day}-${prevSlot.id}`;
        const prevSchedule = schedules[prevCellKey];
        
        if (prevSchedule && prevSchedule.classId) {
          return {
            canMerge: true,
            prevSlot: prevSlot,
            prevKey: prevCellKey,
            mergeType: 'backward'
          };
        }
      }
    }
    
    return { canMerge: false };
  };

  // Handle merging two consecutive slots into a lab
  const handleMergeToLab = (cellKey, day, timeSlot) => {
    // Validate input parameters
    if (!cellKey || !day || !timeSlot || !timeSlot.id) {
      showAlert('Merge Error', 'Invalid parameters for merging time slots', 'error');
      return;
    }
    
    const mergeInfo = checkConsecutiveMerge(day, timeSlot, weeklySchedules);
    
    if (mergeInfo.canMerge) {
      const currentCell = weeklySchedules[cellKey];
      
      if (!currentCell) {
        showAlert('Merge Error', 'Current cell data not found', 'error');
        return;
      }
      
      if (mergeInfo.mergeType === 'forward') {
        const nextCell = weeklySchedules[mergeInfo.nextKey];
        
        if (!nextCell) {
          showAlert('Merge Error', 'Adjacent cell data not found', 'error');
          return;
        }
        
        // Validate slot objects
        if (!mergeInfo.nextSlot || !mergeInfo.nextSlot.end || !timeSlot.start) {
          showAlert('Merge Error', 'Invalid time slot data for forward merge', 'error');
          return;
        }
        
        // Check if both slots have the same subject
        if (currentCell.classId && nextCell.classId && currentCell.classId === nextCell.classId) {
          // Merge into lab - keep first slot, remove second
          setWeeklySchedules(prev => {
            const newSchedules = { ...prev };
            
            // Update first slot to be a lab
            newSchedules[cellKey] = {
              ...currentCell,
              sessionType: 'lab',
              isMerged: true,
              mergedWith: mergeInfo.nextKey,
              startTime: timeSlot.start,
              endTime: mergeInfo.nextSlot.end
            };
            
            // Remove the second slot
            delete newSchedules[mergeInfo.nextKey];
            
            return newSchedules;
          });
          
          showAlert(
            'Merged to Lab',
            `Successfully merged ${timeSlot.label || timeSlot.id} and ${mergeInfo.nextSlot.label || mergeInfo.nextSlot.id} into a lab session.`,
            'success'
          );
        }
      } else if (mergeInfo.mergeType === 'backward') {
        const prevCell = weeklySchedules[mergeInfo.prevKey];
        
        if (!prevCell) {
          showAlert('Merge Error', 'Previous cell data not found', 'error');
          return;
        }
        
        // Validate slot objects
        if (!mergeInfo.prevSlot || !mergeInfo.prevSlot.start || !timeSlot.end) {
          showAlert('Merge Error', 'Invalid time slot data for backward merge', 'error');
          return;
        }
        
        // Check if both slots have the same subject
        if (currentCell.classId && prevCell.classId && currentCell.classId === prevCell.classId) {
          // Merge into lab - keep first slot, remove current
          setWeeklySchedules(prev => {
            const newSchedules = { ...prev };
            
            // Update previous slot to be a lab
            newSchedules[mergeInfo.prevKey] = {
              ...prevCell,
              sessionType: 'lab',
              isMerged: true,
              mergedWith: cellKey,
              startTime: mergeInfo.prevSlot.start,
              endTime: timeSlot.end
            };
            
            // Remove the current slot
            delete newSchedules[cellKey];
            
            return newSchedules;
          });
          
          showAlert(
            'Merged to Lab',
            `Successfully merged ${mergeInfo.prevSlot.label || mergeInfo.prevSlot.id} and ${timeSlot.label || timeSlot.id} into a lab session.`,
            'success'
          );
        }
      }
    }
  };

  const updateCellData = (cellKey, field, value) => {
    setWeeklySchedules(prev => {
      const updated = {
        ...prev,
        [cellKey]: {
          ...prev[cellKey],
          [field]: value
        }
      };

      // If updating classId, check for merging opportunities
      if (field === 'classId' && value) {
        const currentSchedule = updated[cellKey];
        const [day, timeSlotId] = cellKey.split('-');
        const currentTimeIndex = timeSlots.findIndex(slot => slot.id === timeSlotId);
        
        // Validate currentTimeIndex before proceeding
        if (currentTimeIndex === -1) {
          console.warn('Current time slot not found in timeSlots array:', timeSlotId);
          return updated;
        }
        
        // Check for automatic lab merging for specific 2-hour blocks
        const currentSlot = timeSlots[currentTimeIndex];
        if (currentSlot && currentSlot.start && currentSlot.end) {
          // Define valid lab blocks
          const validLabBlocks = [
            { first: { start: '09:00', end: '10:00' }, second: { start: '10:00', end: '11:00' }, merged: { start: '09:00', end: '11:00' } },
            { first: { start: '11:15', end: '12:15' }, second: { start: '12:15', end: '13:15' }, merged: { start: '11:15', end: '13:15' } },
            { first: { start: '14:00', end: '15:00' }, second: { start: '15:00', end: '16:00' }, merged: { start: '14:00', end: '16:00' } }
          ];
          
          let wasMerged = false;
          
          // Check if current slot is part of a valid lab block
          for (const block of validLabBlocks) {
            // Check if this is the first slot of a lab block
            if (currentSlot.start === block.first.start && currentSlot.end === block.first.end) {
              // Check if next slot exists and has the same class (new or existing)
              if (currentTimeIndex < timeSlots.length - 1) {
                const nextSlot = timeSlots[currentTimeIndex + 1];
                if (nextSlot && nextSlot.start === block.second.start && nextSlot.end === block.second.end) {
                  const nextCellKey = `${day}-${nextSlot.id}`;
                  const nextSchedule = updated[nextCellKey];
                  
                  // Check if next slot has the same class (either newly set or already existing)
                  if (nextSchedule && (nextSchedule.classId === value || nextSchedule.classId)) {
                    // If next slot has different class, update it to match
                    if (nextSchedule.classId !== value) {
                      updated[nextCellKey] = {
                        ...nextSchedule,
                        classId: value
                      };
                    }
                    
                    // Automatically merge into lab session
                    updated[cellKey] = {
                      ...updated[cellKey],
                      sessionType: 'lab',
                      isMerged: true,
                      mergedWith: nextCellKey,
                      timeSlot: {
                        ...updated[cellKey].timeSlot,
                        end: block.merged.end,
                        label: `${block.merged.start} - ${block.merged.end} (Lab Session)`
                      }
                    };
                    
                    // Remove the second slot
                    delete updated[nextCellKey];
                    wasMerged = true;
                    
                    setTimeout(() => {
                      const classInfo = classesArray.find(cls => cls._id === value);
                      const subjectName = classInfo ? classInfo.subjectName : 'Selected Subject';
                      showAlert(
                        'Auto-Merged to Lab',
                        `${subjectName} sessions automatically merged into a 2-hour lab (${block.merged.start}-${block.merged.end}).`,
                        'success'
                      );
                    }, 100);
                    
                    break;
                  }
                }
              }
            }
            
            // Check if this is the second slot of a lab block
            if (!wasMerged && currentSlot.start === block.second.start && currentSlot.end === block.second.end) {
              // Check if previous slot exists and has the same class (new or existing)
              if (currentTimeIndex > 0) {
                const prevSlot = timeSlots[currentTimeIndex - 1];
                if (prevSlot && prevSlot.start === block.first.start && prevSlot.end === block.first.end) {
                  const prevCellKey = `${day}-${prevSlot.id}`;
                  const prevSchedule = updated[prevCellKey];
                  
                  // Check if previous slot has the same class (either newly set or already existing)
                  if (prevSchedule && (prevSchedule.classId === value || prevSchedule.classId)) {
                    // If previous slot has different class, update it to match
                    if (prevSchedule.classId !== value) {
                      updated[prevCellKey] = {
                        ...prevSchedule,
                        classId: value
                      };
                    }
                    
                    // Automatically merge into lab session
                    updated[prevCellKey] = {
                      ...updated[prevCellKey],
                      sessionType: 'lab',
                      isMerged: true,
                      mergedWith: cellKey,
                      timeSlot: {
                        ...updated[prevCellKey].timeSlot,
                        end: block.merged.end,
                        label: `${block.merged.start} - ${block.merged.end} (Lab Session)`
                      }
                    };
                    
                    // Remove the current slot
                    delete updated[cellKey];
                    wasMerged = true;
                    
                    setTimeout(() => {
                      const classInfo = classesArray.find(cls => cls._id === value);
                      const subjectName = classInfo ? classInfo.subjectName : 'Selected Subject';
                      showAlert(
                        'Auto-Merged to Lab',
                        `${subjectName} sessions automatically merged into a 2-hour lab (${block.merged.start}-${block.merged.end}).`,
                        'success'
                      );
                    }, 100);
                    
                    break;
                  }
                }
              }
            }
          }
        }
      }

      return updated;
    });
  };

  const handleSubmitWeekly = () => {
    const schedules = Object.values(weeklySchedules).filter(schedule => schedule.classId);
    
    if (schedules.length === 0) {
      showAlert('Please add at least one class to the schedule', 'warning');
      return;
    }

    // Validate that all schedules have required fields
    const invalidSchedules = schedules.filter(schedule => 
      !schedule.classId || !schedule.roomNumber || schedule.roomNumber.trim() === ''
    );

    if (invalidSchedules.length > 0) {
      showAlert('Please fill in all required fields (Subject and Room) for all selected time slots', 'warning');
      return;
    }

    const schedulesData = schedules.map(schedule => {
      // Validate timeSlot before accessing properties
      if (!schedule.timeSlot || !schedule.timeSlot.start || !schedule.timeSlot.end) {
        console.error('Invalid timeSlot data for schedule:', schedule);
        throw new Error('Schedule contains invalid time slot data');
      }
      
      return {
        classId: schedule.classId,
        sessionType: schedule.sessionType,
        dayOfWeek: schedule.day,
        startTime: schedule.timeSlot.start,
        endTime: schedule.timeSlot.end,
        roomNumber: schedule.roomNumber.trim(),
        description: schedule.description || '',
        title: schedule.isMerged ? `${schedule.sessionType} Session` : undefined,
        ...globalSettings
      };
    });

    // Use the mutation to create multiple schedules
    onSubmit(schedulesData);
  };

  const handleSubmitSingle = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleGlobalSettingsChange = (e) => {
    setGlobalSettings(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl mx-4 max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Create Recurring Schedule</h2>
          
          {/* Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setScheduleMode('single')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                scheduleMode === 'single'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📝 Single Schedule
            </button>
            <button
              onClick={() => setScheduleMode('weekly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                scheduleMode === 'weekly'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📅 Weekly Schedule
            </button>
          </div>
        </div>

        {scheduleMode === 'weekly' ? (
          <div className="space-y-6">
            {/* Lab Auto-Merge Information */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="text-green-500 text-xl">🔬</div>
                  <div>
                    <h3 className="font-semibold text-green-900 mb-1">Automatic Lab Merging Enabled</h3>
                    <p className="text-sm text-green-700">
                      When you select the same subject for consecutive time slots in these ranges, they will automatically merge into 2-hour lab sessions:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">9:00-11:00</span>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">11:15-13:15</span>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">14:00-16:00</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={mergeExistingLabs}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded-md font-medium"
                    title="Scan and merge existing consecutive lab sessions"
                  >
                    🔄 Merge Existing
                  </button>
                  <button
                    onClick={() => {
                      console.log('=== DETAILED DEBUG INFO ===');
                      console.log('Current weeklySchedules:', weeklySchedules);
                      console.log('Number of schedules:', Object.keys(weeklySchedules).length);
                      console.log('ExistingSchedules:', existingSchedules);
                      console.log('Number of existing:', existingSchedules?.length || 0);
                      console.log('TimeSlots:', timeSlots);
                      console.log('Days:', days);
                      
                      // Check each time slot mapping
                      console.log('\n=== TIME SLOT ANALYSIS ===');
                      timeSlots.forEach(slot => {
                        console.log(`Slot: ${slot.id} (${slot.start}-${slot.end})`);
                      });
                      
                      // Check existing schedules in detail
                      console.log('\n=== EXISTING SCHEDULES ANALYSIS ===');
                      if (existingSchedules && existingSchedules.length > 0) {
                        existingSchedules.forEach((schedule, index) => {
                          console.log(`Existing Schedule ${index}:`, {
                            id: schedule._id,
                            title: schedule.title,
                            dayOfWeek: schedule.dayOfWeek,
                            startTime: schedule.startTime,
                            endTime: schedule.endTime,
                            sessionType: schedule.sessionType,
                            classId: schedule.classId,
                            className: schedule.classId?.subjectName
                          });
                        });
                      } else {
                        console.log('No existing schedules found');
                      }
                      
                      // Check weekly schedules in detail
                      console.log('\n=== WEEKLY SCHEDULES ANALYSIS ===');
                      Object.entries(weeklySchedules).forEach(([key, schedule]) => {
                        console.log(`Key: ${key}`);
                        console.log(`Schedule:`, {
                          classId: schedule.classId,
                          sessionType: schedule.sessionType,
                          isMerged: schedule.isMerged,
                          timeSlot: schedule.timeSlot,
                          day: schedule.day
                        });
                      });
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded-md font-medium"
                    title="Debug current state"
                  >
                    🐛 Debug
                  </button>
                </div>
              </div>
            </div>
            {/* Global Settings */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium mb-4">Semester Settings</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                  <input
                    type="text"
                    name="semester"
                    value={globalSettings.semester}
                    onChange={handleGlobalSettingsChange}
                    placeholder="e.g., VII"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                  <input
                    type="text"
                    name="academicYear"
                    value={globalSettings.academicYear}
                    onChange={handleGlobalSettingsChange}
                    placeholder="e.g., 2025-26"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester Start</label>
                  <input
                    type="date"
                    name="semesterStartDate"
                    value={globalSettings.semesterStartDate}
                    onChange={handleGlobalSettingsChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester End</label>
                  <input
                    type="date"
                    name="semesterEndDate"
                    value={globalSettings.semesterEndDate}
                    onChange={handleGlobalSettingsChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Weekly Schedule Grid */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3">
                <h3 className="text-lg font-medium">Weekly Schedule Grid</h3>
                <p className="text-sm text-gray-600 mt-1">Click on time slots to add classes. Click again to remove.</p>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-dashed border-gray-200 rounded"></div>
                    <span className="text-gray-600">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-dashed border-blue-300 bg-blue-50 rounded"></div>
                    <span className="text-gray-600">Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-red-300 bg-red-50 rounded"></div>
                    <span className="text-gray-600">⚠️ Already Scheduled</span>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                        Time
                      </th>
                      {days.map(day => (
                        <th key={day} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {timeSlots.map(timeSlot => (
                      <tr key={timeSlot.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50">
                          <div className="text-center">
                            <div className="font-semibold">{timeSlot.start}</div>
                            <div className="text-xs text-gray-500">{timeSlot.end}</div>
                          </div>
                        </td>
                        {days.map(day => {
                          const cellKey = `${day}-${timeSlot.id}`;
                          const cellData = weeklySchedules[cellKey];
                          const hasConflict = checkTimeConflict(day, timeSlot);
                          const conflictingSchedule = hasConflict ? getConflictingSchedule(day, timeSlot) : null;
                          
                          return (
                            <td key={`${day}-${timeSlot.id}`} className="px-2 py-2">
                              <div
                                onClick={() => handleCellClick(day, timeSlot)}
                                title={hasConflict ? `Occupied: ${conflictingSchedule.title} (${conflictingSchedule.sessionType}) - Room ${conflictingSchedule.roomNumber}` : cellData ? 'Click to remove this schedule' : 'Click to add a new class'}
                                className={`min-h-[80px] border-2 rounded-lg transition-all ${
                                  hasConflict
                                    ? 'border-red-300 bg-red-50 cursor-not-allowed'
                                    : cellData
                                    ? 'border-blue-300 bg-blue-50 hover:bg-blue-100 cursor-pointer border-dashed'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer border-dashed'
                                }`}
                              >
                                {hasConflict ? (
                                  <div className="p-2 text-center">
                                    <div className="text-xs text-red-600 font-medium mb-1">⚠️ Occupied</div>
                                    <div className="text-xs text-red-700 font-medium truncate mb-1">{conflictingSchedule.title}</div>
                                    <div className="text-xs text-red-600 truncate">Room: {conflictingSchedule.roomNumber}</div>
                                    <div className="text-xs text-red-500 truncate">{conflictingSchedule.sessionType}</div>
                                    {conflictingSchedule.classId && (
                                      <div className="text-xs text-red-500 truncate mt-1">
                                        {conflictingSchedule.classId.subjectCode}
                                      </div>
                                    )}
                                  </div>
                                ) : cellData ? (
                                  <div className="p-2 space-y-2">
                                    {/* Remove button */}
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="text-xs text-gray-600">
                                        {cellData.isMerged && cellData.sessionType === 'lab' ? (
                                          <span className="text-green-600 font-bold">🔬 2-Hour Lab</span>
                                        ) : (
                                          "Click to remove"
                                        )}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCellClick(day, timeSlot);
                                        }}
                                        className="text-red-500 hover:text-red-700 text-xs font-bold"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    
                                    {/* Show extended time for merged sessions */}
                                    {cellData.isMerged && cellData.sessionType === 'lab' && (
                                      <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-medium mb-2">
                                        {cellData.timeSlot?.label || `${cellData.timeSlot?.start} - ${cellData.timeSlot?.end}`}
                                      </div>
                                    )}
                                    
                                    <select
                                      value={cellData.classId || ''}
                                      onChange={(e) => updateCellData(cellKey, 'classId', e.target.value)}
                                      className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <option value="">Select Subject</option>
                                      {classesArray.map(cls => (
                                        <option key={cls._id} value={cls._id}>
                                          {cls.subjectName}
                                        </option>
                                      ))}
                                    </select>
                                    
                                    <select
                                      value={cellData.sessionType || 'lecture'}
                                      onChange={(e) => updateCellData(cellKey, 'sessionType', e.target.value)}
                                      className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <option value="lecture">Lecture</option>
                                      <option value="lab">Lab</option>
                                      <option value="practical">Practical</option>
                                      <option value="tutorial">Tutorial</option>
                                    </select>
                                    
                                    <input
                                      type="text"
                                      placeholder="Room (Required)"
                                      value={cellData.roomNumber || ''}
                                      onChange={(e) => updateCellData(cellKey, 'roomNumber', e.target.value)}
                                      className={`w-full text-xs border rounded px-2 py-1 ${
                                        cellData.roomNumber && cellData.roomNumber.trim() 
                                          ? 'border-gray-300' 
                                          : 'border-red-300 bg-red-50'
                                      }`}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                ) : (
                                  <div className="h-full flex items-center justify-center text-gray-400 hover:text-gray-600">
                                    <div className="text-center">
                                      <span className="text-2xl">+</span>
                                      <div className="text-xs mt-1">Add Class</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Schedule Summary */}
            {Object.keys(weeklySchedules).length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Schedule Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-green-600 font-medium">
                      ✓ Complete: {Object.values(weeklySchedules).filter(s => s.classId && s.roomNumber && s.roomNumber.trim()).length}
                    </span>
                  </div>
                  <div>
                    <span className="text-red-600 font-medium">
                      ⚠ Incomplete: {Object.values(weeklySchedules).filter(s => s.classId && (!s.roomNumber || !s.roomNumber.trim())).length}
                    </span>
                  </div>
                </div>
                {Object.values(weeklySchedules).filter(s => s.classId && (!s.roomNumber || !s.roomNumber.trim())).length > 0 && (
                  <p className="text-red-600 text-xs mt-2">
                    Please fill in room numbers for all selected time slots before creating the schedule.
                  </p>
                )}
              </div>
            )}

            {/* Submit Button for Weekly */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitWeekly}
                disabled={isLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Creating Schedules...' : 
                  `Create ${Object.values(weeklySchedules).filter(s => s.classId && s.roomNumber && s.roomNumber.trim()).length} Schedule(s)`}
              </button>
            </div>
          </div>
        ) : (
          // Single Schedule Form (existing)
          <form onSubmit={handleSubmitSingle} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select
                  name="classId"
                  value={formData.classId}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Subject</option>
                  {classesArray.map(cls => (
                    <option key={cls._id} value={cls._id}>
                      {cls.subjectName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Session Type</label>
                <select
                  name="sessionType"
                  value={formData.sessionType}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="lecture">Lecture</option>
                  <option value="lab">Lab</option>
                </select>
              </div>
            </div>          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
              <select
                name="dayOfWeek"
                value={formData.dayOfWeek}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
              <input
                type="text"
                name="roomNumber"
                value={formData.roomNumber}
                onChange={handleChange}
                required
                placeholder="e.g., C-204"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
              <input
                type="text"
                name="semester"
                value={formData.semester}
                onChange={handleChange}
                required
                placeholder="e.g., VII"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
              <input
                type="text"
                name="academicYear"
                value={formData.academicYear}
                onChange={handleChange}
                required
                placeholder="e.g., 2025-26"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semester Start</label>
              <input
                type="date"
                name="semesterStartDate"
                value={formData.semesterStartDate}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semester End</label>
              <input
                type="date"
                name="semesterEndDate"
                value={formData.semesterEndDate}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional details about this schedule..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Schedule'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default SchedulePage;