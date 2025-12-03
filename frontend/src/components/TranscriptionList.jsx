import React, { useState, useEffect } from 'react';
import { subscribeToTasks, deleteTask } from '../services/firebase';
import TaskDetails from './TaskDetails';

function TranscriptionList({ projectId, refreshTrigger }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    setLoading(true);

    const unsubscribe = subscribeToTasks(projectId, (newTasks) => {
      // Filter out any tasks that might have been deleted (shouldn't happen, but safety check)
      const validTasks = newTasks.filter(task => task && task.id);
      setTasks(validTasks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId, refreshTrigger]);

  // Filter tasks based on search query and status
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      !searchQuery ||
      task.filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeClass = (status) => {
    const baseClass = 'status-badge';
    return `${baseClass} status-${status}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDeleteTask = async (taskId, e) => {
    e.stopPropagation(); // Prevent opening task details
    
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteTask(projectId, taskId);
      // Task will be removed from list automatically via real-time listener
      console.log('Task deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Failed to delete task: ${error.message || 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by filename or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="queued">Queued</option>
              <option value="transcribing">Transcribing</option>
              <option value="transcribed">Transcribed</option>
              <option value="ready_for_review">Ready for Review</option>
              <option value="reviewed">Reviewed</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        <div className="mt-2 text-sm text-gray-600">
          Showing {filteredTasks.length} of {tasks.length} transcription{tasks.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">No transcriptions found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filter.'
              : 'Upload an audio file to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow relative"
            >
              <div
                onClick={() => setSelectedTask(task)}
                className="cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {task.filename || task.id}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(task.createdAt)}
                    </p>
                  </div>
                  <span className={getStatusBadgeClass(task.status)}>
                    {task.status}
                  </span>
                </div>
              </div>
              
              {/* Delete Button */}
              <button
                onClick={(e) => handleDeleteTask(task.id, e)}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete task"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

                <div className="mt-4 space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="font-medium">{formatDuration(task.duration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Segments:</span>
                    <span className="font-medium">{task.segments?.length || 0}</span>
                  </div>
                </div>

                {task.status === 'error' && task.error && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                    {task.error}
                  </div>
                )}
              </div>
          ))}
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetails
          task={selectedTask}
          projectId={projectId}
          onClose={() => setSelectedTask(null)}
          onDelete={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}

export default TranscriptionList;

