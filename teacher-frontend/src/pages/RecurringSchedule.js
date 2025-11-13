import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { recurringScheduleService } from '../services/recurringScheduleService';
import { classService } from '../services/classService';
import { useModal } from '../hooks/useModal';
import AlertModal from '../components/common/AlertModal';
import ConfirmModal from '../components/common/ConfirmModal';

const RecurringSchedule = () => {
  const [activeTab, setActiveTab] = useState('weekly');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const queryClient = useQueryClient();
  const { alertModal, confirmModal, showAlert, showConfirm, closeAlert, closeConfirm } = useModal();

  const { data: recurringSchedules } = useQuery('recurringSchedules', recurringScheduleService.getRecurringSchedules);
  const { data: classes } = useQuery('classes', classService.getClasses);
  const { data: todaysSchedule } = useQuery('todaysSchedule', recurringScheduleService.getTodaysSchedule);

  const createScheduleMutation = useMutation(recurringScheduleService.createRecurringSchedule, {
    onSuccess: () => {
      showAlert('Success', 'Schedule created successfully!', 'success');
      queryClient.invalidateQueries('recurringSchedules');
      setIsCreateModalOpen(false);
    },
    onError: (error) => {
      showAlert('Error', error.response?.data?.message || 'Failed to create schedule', 'error');
    }
  });

  const deleteScheduleMutation = useMutation(recurringScheduleService.deleteRecurringSchedule, {
    onSuccess: () => {
      showAlert('Success', 'Schedule deleted successfully!', 'success');
      queryClient.invalidateQueries('recurringSchedules');
    }
  });

  const mergeLabMutation = useMutation(
    ({ scheduleIds, customLabel }) => recurringScheduleService.mergeLabSessions(scheduleIds, customLabel),
    {
      onSuccess: (data) => {
        showAlert('Success', data.message, 'success');
        queryClient.invalidateQueries('recurringSchedules');
      }
    }
  );

  const createWeeklyMutation = useMutation(
    recurringScheduleService.createWeeklyFromRecurring,
    {
      onSuccess: (data) => {
        showAlert('Success', `Weekly schedule template created successfully from "${data.sourceRecurringSchedule.title}"`, 'success');
        // Optionally refresh weekly schedules if needed
      },
      onError: (error) => {
        showAlert('Error', error.response?.data?.message || 'Failed to create weekly schedule', 'error');
      }
    }
  );

  const schedulesArray = recurringSchedules?.data || [];
  const classesArray = Array.isArray(classes) ? classes : [];
  const todaysClasses = todaysSchedule?.data || [];

  // Lab merge logic with proper validation
  const findMergeCandidates = () => {
    const candidates = [];
    const labBlocks = [
      { first: { start: '09:00', end: '10:00' }, second: { start: '10:00', end: '11:00' }, merged: '09:00-11:00' },
      { first: { start: '11:15', end: '12:15' }, second: { start: '12:15', end: '13:15' }, merged: '11:15-13:15' },
      { first: { start: '14:00', end: '15:00' }, second: { start: '15:00', end: '16:00' }, merged: '14:00-16:00' }
    ];

    schedulesArray.forEach(schedule1 => {
      if (!schedule1 || !schedule1.classId) return;
      
      labBlocks.forEach(block => {
        if (schedule1.startTime === block.first.start && schedule1.endTime === block.first.end) {
          const schedule2 = schedulesArray.find(s => 
            s && s._id !== schedule1._id &&
            s.classId && s.classId._id === schedule1.classId._id &&
            s.dayOfWeek === schedule1.dayOfWeek &&
            s.startTime === block.second.start &&
            s.endTime === block.second.end
          );
          
          if (schedule2) {
            candidates.push({
              schedules: [schedule1, schedule2],
              mergedTime: block.merged,
              subjectCode: schedule1.classId.subjectCode || 'Unknown',
              dayOfWeek: schedule1.dayOfWeek
            });
          }
        }
      });
    });

    return candidates;
  };

  const mergeCandidates = findMergeCandidates();

  const handleMergeLabSessions = (candidate) => {
    if (!candidate || !candidate.schedules) return;
    
    const scheduleIds = candidate.schedules.map(s => s._id);
    const customLabel = `${candidate.subjectCode} - Lab Session`;
    
    showConfirm(
      `Merge ${candidate.subjectCode} sessions on ${candidate.dayOfWeek} into a 2-hour lab (${candidate.mergedTime})?`,
      () => mergeLabMutation.mutate({ scheduleIds, customLabel }),
      { title: 'Merge into 2-Hour Lab', confirmText: 'Merge to Lab', cancelText: 'Cancel' }
    );
  };

  const handleDeleteSchedule = (schedule) => {
    showConfirm(
      `Delete recurring schedule for "${schedule.title}"?`,
      () => deleteScheduleMutation.mutate(schedule._id),
      { title: 'Delete Schedule', type: 'danger', confirmText: 'Delete', cancelText: 'Cancel' }
    );
  };

  const handleCreateWeeklySchedule = (schedule) => {
    showConfirm(
      `Create a weekly schedule template from "${schedule.title}"?\n\nThis will create a blank weekly schedule with the same time slot, class, and room details.`,
      () => createWeeklyMutation.mutate(schedule._id),
      { 
        title: 'Create Weekly Schedule', 
        type: 'info', 
        confirmText: 'Create Weekly Template', 
        cancelText: 'Cancel' 
      }
    );
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Semester Schedule</h1>
          <p className="text-gray-600 mt-1">Manage your recurring schedules</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
        >
          Create Schedule
        </button>
      </div>

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

      {activeTab === 'today' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Today's Classes</h2>
          {todaysClasses.length > 0 ? (
            <div className="space-y-4">
              {todaysClasses.map((cls) => (
                <div key={cls._id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg">
                    {cls.classId?.subjectCode} - {cls.classId?.subjectName}
                  </h3>
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
              <p className="text-gray-500">Enjoy your free day!</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'weekly' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="text-blue-500 text-xl">🔬</div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Smart Lab Merging</h3>
                <p className="text-sm text-blue-700">
                  Consecutive 1-hour sessions for the same subject will automatically merge into 2-hour labs for these time blocks:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">9:00-11:00</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">11:15-13:15</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">14:00-16:00</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Weekly Schedule Pattern</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => {
                const daySchedules = schedulesArray.filter(s => s.dayOfWeek === day);
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
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => handleCreateWeeklySchedule(schedule)}
                                  className="text-green-600 hover:text-green-800 text-xs bg-green-50 hover:bg-green-100 px-2 py-1 rounded"
                                  title="Add as Weekly Schedule"
                                >
                                  📅 Add Weekly
                                </button>
                                <button
                                  onClick={() => handleDeleteSchedule(schedule)}
                                  className="text-red-600 hover:text-red-800 text-xs bg-red-50 hover:bg-red-100 px-2 py-1 rounded"
                                >
                                  Delete
                                </button>
                              </div>
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

      {activeTab === 'list' && (
        <div className="space-y-6">
          {mergeCandidates.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">🔗 Lab Merge Suggestions</h3>
              <p className="text-sm text-blue-700 mb-3">
                Found consecutive 1-hour sessions that can be merged into 2-hour lab blocks:
              </p>
              <div className="space-y-2">
                {mergeCandidates.map((candidate, index) => (
                  <div key={index} className="bg-white rounded p-3 flex justify-between items-center">
                    <div>
                      <span className="font-medium text-blue-900">
                        {candidate.subjectCode} on {candidate.dayOfWeek}
                      </span>
                      <span className="text-sm text-blue-600 ml-2">
                        → {candidate.mergedTime}
                      </span>
                    </div>
                    <button
                      onClick={() => handleMergeLabSessions(candidate)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded"
                    >
                      🔬 Merge to Lab
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">All Recurring Schedules</h2>
            </div>
            {schedulesArray.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {schedulesArray.map((schedule) => (
                  <div key={schedule._id} className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{schedule.title}</h3>
                        <p className="text-gray-600 mt-1">
                          {schedule.classId?.subjectCode} - {schedule.classId?.subjectName}
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
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleCreateWeeklySchedule(schedule)}
                          className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-md hover:bg-green-200 flex items-center space-x-1"
                          title="Create weekly schedule template from this recurring schedule"
                        >
                          <span>📅</span>
                          <span>Add as Weekly Schedule</span>
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(schedule)}
                          className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded-md hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
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
        </div>
      )}

      {isCreateModalOpen && (
        <CreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={(data) => createScheduleMutation.mutate(data)}
          classes={classesArray}
          isLoading={createScheduleMutation.isLoading}
        />
      )}

      <AlertModal isOpen={alertModal.isOpen} title={alertModal.title} message={alertModal.message} type={alertModal.type} onClose={closeAlert} />
      <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} type={confirmModal.type} confirmText={confirmModal.confirmText} cancelText={confirmModal.cancelText} onConfirm={confirmModal.onConfirm} onClose={closeConfirm} />
    </div>
  );
};

const CreateModal = ({ isOpen, onClose, onSubmit, classes, isLoading }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
        <h2 className="text-xl font-semibold mb-4">Feature Temporarily Unavailable</h2>
        <p className="text-gray-600 mb-4">
          The create schedule modal is being updated. Please use the existing schedules for now.
        </p>
        <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded-md">
          Close
        </button>
      </div>
    </div>
  );
};

export default RecurringSchedule;