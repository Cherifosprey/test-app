import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Building2, Layers } from 'lucide-react';
import api from '../../api/client.js';
import { MODULE_LABELS_FR } from '../../config/erpConfig.js';

export default function ERPPlansPage() {
  const [plans, setPlans] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/admin/erp/plans'),
      api.get('/admin/workspaces'),
    ]).then(([plansRes, workspacesRes]) => {
      setPlans(plansRes.data || []);
      setWorkspaces(workspacesRes.data || []);
      if ((workspacesRes.data || []).length) {
        setWorkspaceId(String(workspacesRes.data[0].id));
      }
    });
  }, []);

  const selectedWorkspace = useMemo(
    () => workspaces.find(w => String(w.id) === String(workspaceId)),
    [workspaces, workspaceId],
  );

  const applyPlan = async plan => {
    if (!workspaceId) return;
    setSaving(plan.key);
    setMessage('');
    try {
      await api.patch(`/admin/erp/workspaces/${workspaceId}/plan`, { plan: plan.key });
      setMessage(`L’offre ${plan.label} a été appliquée à ${selectedWorkspace?.name || 'l’entreprise'}.`);
    } catch (error) {
      setMessage(error?.response?.data?.detail || 'Impossible d’appliquer cette offre.');
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Offres ERP</h1>
        <p className="mt-1 text-sm text-slate-500">
          Activez automatiquement les bons modules pour chaque entreprise cliente.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Building2 size={16} /> Entreprise cliente
        </label>
        <select
          value={workspaceId}
          onChange={e => setWorkspaceId(e.target.value)}
          className="mt-3 w-full max-w-xl rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
        >
          {workspaces.map(workspace => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name} ({workspace.slug})
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map(plan => (
          <div key={plan.key} className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{plan.label}</h2>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {plan.module_count} modules
              </span>
            </div>

            <div className="mt-4 flex-1 space-y-2">
              {plan.modules.map(module => (
                <div key={module} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  {MODULE_LABELS_FR[module] || module}
                </div>
              ))}
            </div>

            <button
              onClick={() => applyPlan(plan)}
              disabled={!workspaceId || !!saving}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 dark:bg-white px-4 py-2.5 text-sm font-semibold text-white dark:text-slate-900 disabled:opacity-50"
            >
              <Layers size={15} />
              {saving === plan.key ? 'Application…' : `Appliquer ${plan.label}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
