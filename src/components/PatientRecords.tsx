"use client";
import { useState, useEffect } from 'react';
import { Search, Eye, Calendar, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface PatientRecord {
  patientId: string;
  name: string;
  lastDiagnosis: string | null;
  prediction: string | null;
  confidence: number | null;
  status: string | null;
  caseId: string | null;
}

const PAGE_SIZE = 10;

export function PatientRecords() {
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function fetchRecords() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('cases')
        .select('id, predicted_class, confidence, risk_level, created_at, patients(id, patient_id, name)')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        toast.error('Failed to load patient records');
        setLoading(false);
        return;
      }

      // Deduplicate: keep most recent case per patient
      const seen = new Set<string>();
      const deduped: PatientRecord[] = [];

      for (const c of data ?? []) {
        const patient = c.patients as unknown as { patient_id: string; name: string } | null;
        if (!patient || seen.has(patient.patient_id)) continue;
        seen.add(patient.patient_id);
        deduped.push({
          patientId: patient.patient_id,
          name: patient.name,
          lastDiagnosis: c.created_at ? new Date(c.created_at).toLocaleDateString('en-CA') : null,
          prediction: c.predicted_class,
          confidence: c.confidence != null ? Number(c.confidence) : null,
          status: c.risk_level,
          caseId: c.id,
        });
      }

      setRecords(deduped);
      setLoading(false);
    }

    fetchRecords();
  }, []);

  const filtered = records.filter((r) => {
    const matchesSearch =
      r.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || r.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearch = (q: string) => { setSearchQuery(q); setCurrentPage(1); };
  const handleStatusFilter = (s: string) => { setSelectedStatus(s); setCurrentPage(1); };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'High Risk': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      case 'Moderate Risk': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'Benign': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
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
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by Patient ID or Name..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
              />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
            >
              <option value="all">All Status</option>
              <option value="High Risk">High Risk</option>
              <option value="Moderate Risk">Moderate Risk</option>
              <option value="Benign">Benign</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-400 dark:text-gray-500">Loading records...</div>
          ) : paginated.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-gray-900 dark:text-white mb-2">No Records Found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery || selectedStatus !== 'all'
                  ? 'Try adjusting your search or filter criteria'
                  : 'No patient records available'}
              </p>
            </div>
          ) : (
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
                {paginated.map((record) => (
                  <tr
                    key={record.patientId}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="py-4 px-6 text-gray-900 dark:text-gray-100">{record.patientId}</td>
                    <td className="py-4 px-6 text-gray-900 dark:text-gray-100">{record.name}</td>
                    <td className="py-4 px-6 text-gray-600 dark:text-gray-400">{record.lastDiagnosis ?? '—'}</td>
                    <td className="py-4 px-6 text-gray-900 dark:text-gray-100">{record.prediction ?? '—'}</td>
                    <td className="py-4 px-6">
                      {record.confidence != null ? (
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[100px]">
                            <div
                              className="bg-teal-500 h-2 rounded-full"
                              style={{ width: `${record.confidence}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-900 dark:text-gray-100">{record.confidence}%</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-3 py-1 text-xs rounded-full ${getStatusColor(record.status)}`}>
                        {record.status ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        className="flex items-center space-x-1 px-3 py-2 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
                        onClick={() => toast.info(`Opening record ${record.patientId}...`)}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="text-sm">View Full Report</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing <span className="text-gray-900 dark:text-white">{paginated.length}</span> of{' '}
                <span className="text-gray-900 dark:text-white">{filtered.length}</span> records
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-700 dark:hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
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
