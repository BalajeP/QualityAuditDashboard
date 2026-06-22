import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router';
import { Save, X, Plus } from 'lucide-react';
import { Audit, AuditScore } from '../types';
import { toast } from 'sonner';

export function AuditForm() {
  const { agents, categories, addAudit } = useData();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [callId, setCallId] = useState('');
  const [duration, setDuration] = useState('');
  const [auditorName, setAuditorName] = useState('');
  const [scores, setScores] = useState<Record<string, { score: number; comments: string }>>({});

  const handleScoreChange = (categoryId: string, score: number) => {
    if (!isAdmin) return;
    setScores(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], score }
    }));
  };

  const handleCommentsChange = (categoryId: string, comments: string) => {
    if (!isAdmin) return;
    setScores(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], comments }
    }));
  };

  const calculateTotal = () => {
    const total = Object.entries(scores).reduce((sum, [categoryId, data]) => {
      return sum + (data.score || 0);
    }, 0);
    const maxPossible = categories.reduce((sum, c) => sum + c.maxScore, 0);
    return { total, percentage: maxPossible > 0 ? (total / maxPossible) * 100 : 0 };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast.error('You do not have permission to submit audits.');
      return;
    }

    if (!selectedAgentId) {
      toast.error('Please select an agent');
      return;
    }

    if (!auditorName) {
      toast.error('Please enter auditor name');
      return;
    }

    const selectedAgent = agents.find(a => a.id === selectedAgentId);
    if (!selectedAgent) return;

    const auditScores: AuditScore[] = categories.map(category => ({
      categoryId: category.id,
      score: scores[category.id]?.score || 0,
      comments: scores[category.id]?.comments || '',
    }));

    const { total, percentage } = calculateTotal();

    const newAudit: Audit = {
      id: `audit-${Date.now()}`,
      agentId: selectedAgentId,
      agentName: selectedAgent.name,
      date: new Date().toISOString(),
      scores: auditScores,
      totalScore: total,
      percentage,
      auditorName,
      callId: callId || undefined,
      duration: duration || undefined,
    };

    addAudit(newAudit);
    toast.success('Audit saved successfully!');
    navigate('/');
  };

  const { total, percentage } = calculateTotal();
  const allScoresEntered = categories.every(c => scores[c.id]?.score > 0);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
          <h2 className="text-2xl font-bold">New Quality Audit</h2>
          <p className="text-blue-100 mt-1">Evaluate agent performance across key categories</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {!isAdmin && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm font-semibold flex items-center gap-2">
              <span>View Only: You do not have permission to submit new audits.</span>
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Agent <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                disabled={!isAdmin}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                required
              >
                <option value="">Select an agent...</option>
                {agents.filter(a => a.status === 'active').map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} - {agent.team}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Auditor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={auditorName}
                onChange={(e) => setAuditorName(e.target.value)}
                disabled={!isAdmin}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                placeholder="Your name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Call ID (Optional)
              </label>
              <input
                type="text"
                value={callId}
                onChange={(e) => setCallId(e.target.value)}
                disabled={!isAdmin}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                placeholder="CALL-12345"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Duration (Optional)
              </label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={!isAdmin}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                placeholder="5:30"
              />
            </div>
          </div>

          {/* Score Categories */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900 mb-4">Score Categories</h3>
            <div className="space-y-6">
              {categories.map((category) => (
                <div key={category.id} className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="font-medium text-slate-900">
                      {category.name}
                    </label>
                    <span className="text-sm text-slate-600">
                      Max: {category.maxScore} points
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <input
                        type="number"
                        min="0"
                        max={category.maxScore}
                        value={scores[category.id]?.score || ''}
                        onChange={(e) => handleScoreChange(category.id, Number(e.target.value))}
                        disabled={!isAdmin}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                        placeholder="0"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        value={scores[category.id]?.comments || ''}
                        onChange={(e) => handleCommentsChange(category.id, e.target.value)}
                        disabled={!isAdmin}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                        placeholder="Comments or feedback..."
                      />
                    </div>
                  </div>
                  
                  {/* Visual score indicator */}
                  {scores[category.id]?.score > 0 && (
                    <div className="mt-2">
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                           className="bg-blue-500 h-2 rounded-full transition-all"
                           style={{ width: `${(scores[category.id].score / category.maxScore) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Score Summary */}
          {allScoresEntered && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Score</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {total} / {categories.reduce((sum, c) => sum + c.maxScore, 0)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600">Percentage</p>
                  <p className={`text-3xl font-bold ${
                    percentage >= 80 ? 'text-green-600' :
                    percentage >= 60 ? 'text-blue-600' :
                    'text-orange-600'
                  }`}>
                    {Math.round(percentage)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            {isAdmin && (
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Save className="size-5" />
                Save Audit
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <X className="size-5" />
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
