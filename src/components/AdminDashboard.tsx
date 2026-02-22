import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Users, TrendingUp, Award } from 'lucide-react';

const performanceData = [
  { week: 'Week 1', f1Score: 0.87, accuracy: 0.89, precision: 0.88 },
  { week: 'Week 2', f1Score: 0.88, accuracy: 0.90, precision: 0.89 },
  { week: 'Week 3', f1Score: 0.89, accuracy: 0.91, precision: 0.90 },
  { week: 'Week 4', f1Score: 0.90, accuracy: 0.92, precision: 0.91 },
  { week: 'Week 5', f1Score: 0.89, accuracy: 0.91, precision: 0.90 },
  { week: 'Week 6', f1Score: 0.91, accuracy: 0.93, precision: 0.92 },
];

const doctorActivityData = [
  { doctor: 'Dr. Johnson', diagnoses: 45 },
  { doctor: 'Dr. Chen', diagnoses: 38 },
  { doctor: 'Dr. Rodriguez', diagnoses: 42 },
  { doctor: 'Dr. Williams', diagnoses: 35 },
  { doctor: 'Dr. Martinez', diagnoses: 29 },
];

const classificationBreakdown = [
  { class: 'Melanoma', count: 23 },
  { class: 'Nevus', count: 78 },
  { class: 'BCC', count: 15 },
  { class: 'Actinic Keratosis', count: 12 },
  { class: 'Others', count: 31 },
];

export function AdminDashboard() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white mb-2">
          Doctor Activity and System Audit
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor system performance, usage metrics, and compliance tracking
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
              <Activity className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            </div>
            <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
              +12.5%
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Diagnoses</p>
          <p className="text-gray-900 dark:text-white">1,847</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
              +2
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Active Doctors</p>
          <p className="text-gray-900 dark:text-white">24</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Award className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
              +0.3%
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Model Accuracy</p>
          <p className="text-gray-900 dark:text-white">93.2%</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">
              +0.2s
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Avg Inference Time</p>
          <p className="text-gray-900 dark:text-white">4.5s</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Model Performance Trends */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-gray-900 dark:text-white">
              Model Performance Trends
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Weekly F1-Score, Accuracy, and Precision metrics
            </p>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis 
                  dataKey="week" 
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  stroke="#6B7280"
                />
                <YAxis 
                  domain={[0.85, 0.95]}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  stroke="#6B7280"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F3F4F6'
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '12px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="f1Score" 
                  stroke="#14B8A6" 
                  strokeWidth={2}
                  name="F1-Score"
                  dot={{ fill: '#14B8A6', r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="accuracy" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="Accuracy"
                  dot={{ fill: '#3B82F6', r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="precision" 
                  stroke="#8B5CF6" 
                  strokeWidth={2}
                  name="Precision"
                  dot={{ fill: '#8B5CF6', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Doctor Activity Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-gray-900 dark:text-white">
              Doctor Activity Metrics
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Diagnoses performed per doctor (last 30 days)
            </p>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={doctorActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis 
                  dataKey="doctor" 
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  stroke="#6B7280"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  stroke="#6B7280"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F3F4F6'
                  }}
                />
                <Bar 
                  dataKey="diagnoses" 
                  fill="#14B8A6"
                  name="Diagnoses"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Classification Breakdown and System Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classification Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-gray-900 dark:text-white">
              Classification Distribution
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Breakdown by lesion type (last 30 days)
            </p>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={classificationBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis 
                  type="number"
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  stroke="#6B7280"
                />
                <YAxis 
                  dataKey="class" 
                  type="category"
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  stroke="#6B7280"
                  width={120}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F3F4F6'
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="#3B82F6"
                  name="Count"
                  radius={[0, 8, 8, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Usage Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-gray-900 dark:text-white">
              System Usage Statistics
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Total system counts and compliance metrics
            </p>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Patients</p>
                <p className="text-gray-900 dark:text-white">1,234</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Reports</p>
                <p className="text-gray-900 dark:text-white">1,847</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">High Risk Cases</p>
                <p className="text-red-600 dark:text-red-400">67</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Benign Cases</p>
                <p className="text-green-600 dark:text-green-400">1,512</p>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm text-gray-900 dark:text-white mb-3">
                Compliance Metrics
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Reports Reviewed</span>
                    <span className="text-gray-900 dark:text-white">98.5%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-teal-500 h-2 rounded-full" style={{ width: '98.5%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Follow-up Documented</span>
                    <span className="text-gray-900 dark:text-white">94.2%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '94.2%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Audit Trail Complete</span>
                    <span className="text-gray-900 dark:text-white">100%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
