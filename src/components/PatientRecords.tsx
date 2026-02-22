import { useState } from 'react';
import { Search, Eye, Calendar, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const mockRecords = [
  { id: 'PT-2024-001', name: 'John Anderson', lastDiagnosis: '2025-12-10', prediction: 'Melanoma', confidence: 92.5, status: 'High Risk' },
  { id: 'PT-2024-002', name: 'Maria Garcia', lastDiagnosis: '2025-12-09', prediction: 'Nevus', confidence: 88.3, status: 'Benign' },
  { id: 'PT-2024-003', name: 'Robert Chen', lastDiagnosis: '2025-12-08', prediction: 'Basal Cell Carcinoma', confidence: 85.7, status: 'Moderate Risk' },
  { id: 'PT-2024-004', name: 'Emily Williams', lastDiagnosis: '2025-12-07', prediction: 'Benign Keratosis', confidence: 91.2, status: 'Benign' },
  { id: 'PT-2024-005', name: 'David Martinez', lastDiagnosis: '2025-12-06', prediction: 'Actinic Keratosis', confidence: 79.4, status: 'Moderate Risk' },
  { id: 'PT-2024-006', name: 'Sarah Johnson', lastDiagnosis: '2025-12-05', prediction: 'Nevus', confidence: 94.8, status: 'Benign' },
  { id: 'PT-2024-007', name: 'Michael Brown', lastDiagnosis: '2025-12-04', prediction: 'Dermatofibroma', confidence: 82.1, status: 'Benign' },
  { id: 'PT-2024-008', name: 'Lisa Taylor', lastDiagnosis: '2025-12-03', prediction: 'Melanoma', confidence: 87.9, status: 'High Risk' },
];

export function PatientRecords() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const filteredRecords = mockRecords.filter((record) => {
    const matchesSearch = 
      record.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = selectedStatus === 'all' || record.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'High Risk':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      case 'Moderate Risk':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'Benign':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const handleViewRecord = (id: string) => {
    toast.success(`Loading patient record ${id}...`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white mb-2">
          Patient History and Record Lookup
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Search and review patient diagnostic records
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Patient ID or Name..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
              />
            </div>

            <div className="flex items-center space-x-4">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
              >
                <option value="all">All Status</option>
                <option value="High Risk">High Risk</option>
                <option value="Moderate Risk">Moderate Risk</option>
                <option value="Benign">Benign</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredRecords.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-gray-900 dark:text-white mb-2">
                No Records Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery || selectedStatus !== 'all' 
                  ? 'Try adjusting your search or filter criteria' 
                  : 'No patient records available'}
              </p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-4 px-6 text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>Patient ID</span>
                      </div>
                    </th>
                    <th className="text-left py-4 px-6 text-sm text-gray-700 dark:text-gray-300">Patient Name</th>
                    <th className="text-left py-4 px-6 text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span>Last Diagnosis</span>
                      </div>
                    </th>
                    <th className="text-left py-4 px-6 text-sm text-gray-700 dark:text-gray-300">Primary Prediction</th>
                    <th className="text-left py-4 px-6 text-sm text-gray-700 dark:text-gray-300">Confidence</th>
                    <th className="text-left py-4 px-6 text-sm text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-left py-4 px-6 text-sm text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="py-4 px-6 text-gray-900 dark:text-gray-100">
                        {record.id}
                      </td>
                      <td className="py-4 px-6 text-gray-900 dark:text-gray-100">
                        {record.name}
                      </td>
                      <td className="py-4 px-6 text-gray-600 dark:text-gray-400">
                        {record.lastDiagnosis}
                      </td>
                      <td className="py-4 px-6 text-gray-900 dark:text-gray-100">
                        {record.prediction}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[100px]">
                            <div
                              className="bg-teal-500 h-2 rounded-full"
                              style={{ width: `${record.confidence}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-900 dark:text-gray-100">{record.confidence}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-block px-3 py-1 text-xs rounded-full ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <button className="flex items-center space-x-1 px-3 py-2 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors" onClick={() => handleViewRecord(record.id)}>
                          <Eye className="h-4 w-4" />
                          <span className="text-sm">View Full Report</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {filteredRecords.length > 0 && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing <span className="text-gray-900 dark:text-white">{filteredRecords.length}</span> of <span className="text-gray-900 dark:text-white">{mockRecords.length}</span> records
              </p>
              <div className="flex space-x-2">
                <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                  Previous
                </button>
                <button className="px-4 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-700 dark:hover:bg-teal-600 transition-colors">
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}