import React from 'react';
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const AlertsPanel = ({ alerts, onAcknowledge }) => {
  const getIcon = (severity) => {
    switch (severity) {
      case 'red': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'yellow': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'green': return <CheckCircle className="w-5 h-5 text-green-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityStyle = (severity, acknowledged) => {
    if (acknowledged) return 'bg-white/5 border-white/10 opacity-60';
    
    switch (severity) {
      case 'red': return 'bg-red-500/10 border-red-500/20 shadow-lg shadow-red-500/10 animate-pulse-red';
      case 'yellow': return 'bg-yellow-500/10 border-yellow-500/20';
      default: return 'bg-green-500/10 border-green-500/20';
    }
  };

  return (
    <div className="glass-card p-6 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center space-x-2">
          <span>Clinical Alerts</span>
          <span className="bg-[#00C9A7]/20 text-[#00C9A7] text-xs px-2 py-0.5 rounded-full">
            {alerts.filter(a => !a.acknowledged).length} Active
          </span>
        </h3>
        <span className="text-xs text-slate-400">Real-time monitoring</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {alerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 opacity-50">
            <CheckCircle className="w-10 h-10" />
            <p>No alerts detected</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div 
              key={alert.id} 
              className={`p-4 rounded-xl border transition-all duration-300 ${getSeverityStyle(alert.severity, alert.acknowledged)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="mt-1">{getIcon(alert.severity)}</div>
                  <div>
                    <h4 className={`text-sm font-bold uppercase tracking-wider mb-1 ${
                      alert.severity === 'red' ? 'text-red-400' : 
                      alert.severity === 'yellow' ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {alert.alert_type.replace(/_/g, ' ')}
                    </h4>
                    <p className="text-sm text-slate-300 leading-relaxed mb-3">
                      {alert.message}
                    </p>
                    <div className="flex items-center space-x-4 text-[10px] text-slate-500">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}</span>
                      </span>
                      {alert.acknowledged && (
                        <span className="flex items-center space-x-1 text-green-500/70">
                          <CheckCircle className="w-3 h-3" />
                          <span>Acknowledged</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {!alert.acknowledged && (
                  <button 
                    onClick={() => onAcknowledge(alert.id)}
                    className="text-[10px] font-bold uppercase tracking-widest text-[#00C9A7] hover:text-[#00FAD9] transition-colors cursor-pointer"
                  >
                    Ack
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AlertsPanel;
