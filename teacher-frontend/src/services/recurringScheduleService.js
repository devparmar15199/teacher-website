import api from './api';

export const recurringScheduleService = {
  // Get all recurring schedules for teacher
  getRecurringSchedules: async () => {
    const response = await api.get('/teacher/recurring-schedules');
    return response.data;
  },

  // Create new recurring schedule
  createRecurringSchedule: async (scheduleData) => {
    const response = await api.post('/teacher/recurring-schedules', scheduleData);
    return response.data;
  },

  // Update recurring schedule
  updateRecurringSchedule: async (id, scheduleData) => {
    const response = await api.put(`/teacher/recurring-schedules/${id}`, scheduleData);
    return response.data;
  },

  // Delete recurring schedule
  deleteRecurringSchedule: async (id) => {
    const response = await api.delete(`/teacher/recurring-schedules/${id}`);
    return response.data;
  },

  // Get today's schedule
  getTodaysSchedule: async () => {
    const response = await api.get('/teacher/recurring-schedules/today');
    return response.data;
  },

  // Get schedule for date range
  getScheduleForDateRange: async (startDate, endDate) => {
    const response = await api.get(`/teacher/recurring-schedules/range?startDate=${startDate}&endDate=${endDate}`);
    return response.data;
  },

  // Create schedule override
  createScheduleOverride: async (overrideData) => {
    const response = await api.post('/teacher/recurring-schedules/override', overrideData);
    return response.data;
  }
};
