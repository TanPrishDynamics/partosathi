import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Clock, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const SEVERITY_CONFIG = {
  red: {
    icon:  AlertCircle,
    dotCls:  'bg-red-500 animate-pulse',
    rowCls:  'bg-red-500/6 border-red-500/20 hover:bg-red-500/10',
    labelCls: 'text-red-400',
    badge:   'bg-red-500/10 text-red-400 border-red-500/20',
  },
  yellow: {
    icon:  AlertTriangle,
    dotCls:  'bg-yellow-500',
    rowCls:  'bg-yellow-500/5 border-yellow-500/15 hover:bg-yellow-500/8',
    labelCls: 'text-yellow-400',
    badge:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  },
};

const AlertsPanel = ({ alerts, onAcknowledge }) => {
  const active = alerts.filter(a => !a.acknowledged);
  const acked  = alerts.filter(a => a.acknowledged);

  return (
    <div className="glass-card overflow-hidden animate-fade-in stagger-4">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-slate-200" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
            Clinical Alerts
          </h3>
          {active.length > 0 ? (
            <span className="badge badge-abnormal" style={{ fontSize: '10px' }}>
              {active.length} Active
            </span>
          ) : (
            <span className="badge badge-normal" style={{ fontSize: '10px' }}>
              All Clear
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">
          Real-time · Every 30s
        </span>
      </div>

      {/* Alert list */}
      <div className="max-h-[360px] overflow-y-auto p-4 space-y-2">
        {alerts.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-slate-600">
            <div className="w-12 h-12 rounded-2xl bg-green-500/8 border border-green-500/15 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-green-500/60" />
            </div>
            <p className="text-sm font-semibold">No active alerts</p>
            <p className="text-xs text-slate-700">All parameters within normal range</p>
          </div>
        ) : (
          <>
            {active.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.yellow;
              const Icon = cfg.icon;
              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border transition-all duration-200 ${cfg.rowCls} animate-slide-up`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        <Icon className={`w-4 h-4 ${cfg.labelCls}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`text-[10px] font-black uppercase tracking-[0.1em] ${cfg.labelCls}`}>
                            {alert.alert_type.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <Clock className="w-2.5 h-2.5 text-slate-600" />
                          <span className="text-[10px] text-slate-600">
                            {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onAcknowledge(alert.id)}
                      className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-cyan-500 hover:text-cyan-300 transition-colors px-2 py-1 rounded-lg hover:bg-cyan-400/8 cursor-pointer"
                    >
                      Ack
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Acknowledged (collapsed) */}
            {acked.length > 0 && (
              <details className="mt-2">
                <summary className="text-[10px] text-slate-600 font-bold uppercase tracking-wider cursor-pointer px-2 py-1 hover:text-slate-500 transition-colors">
                  {acked.length} acknowledged
                </summary>
                <div className="mt-2 space-y-1.5">
                  {acked.map(alert => (
                    <div key={alert.id}
                      className="px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.04] opacity-50"
                    >
                      <p className="text-[10px] font-bold uppercase text-slate-500">{alert.alert_type.replace(/_/g, ' ')}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{alert.message}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AlertsPanel;
