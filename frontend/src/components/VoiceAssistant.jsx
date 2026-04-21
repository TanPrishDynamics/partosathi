import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import api from '../services/api';

/**
 * ColpAI Voice Assistant
 * 
 * Uses the browser's native Web Speech API for zero-latency transcription,
 * then sends the transcript to the Flask NLP extractor to parse clinical JSON.
 * Calls `onDataExtracted` with the structured fields to auto-fill the form.
 */
const VoiceAssistant = ({ onDataExtracted, onClose }) => {
  const [status, setStatus] = useState('idle'); // idle | listening | processing | done | error
  const [transcript, setTranscript] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [error, setError] = useState('');
  const [interimText, setInterimText] = useState('');
  
  const recognitionRef = useRef(null);

  const isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      setStatus('error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus('listening');
      setError('');
      setTranscript('');
      setInterimText('');
      setExtractedData(null);
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += result;
        } else {
          interim += result;
        }
      }
      if (interim) setInterimText(interim);
      if (final) setTranscript(final);
    };

    recognition.onerror = (event) => {
      setError(`Microphone error: ${event.error}. Ensure microphone permissions are granted.`);
      setStatus('error');
    };

    recognition.onend = () => {
      setInterimText('');
      // Only process if we got something
      if (transcript || recognitionRef._lastFinal) {
        processTranscript(transcript || recognitionRef._lastFinal);
      } else {
        setStatus('idle');
      }
    };

    // Hook into result to capture final before onend
    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += result;
        else interim += result;
      }
      setInterimText(interim);
      if (final) {
        setTranscript(final);
        recognitionRef._lastFinal = final;
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const processTranscript = async (text) => {
    if (!text?.trim()) {
      setStatus('idle');
      return;
    }

    setStatus('processing');
    setTranscript(text);

    try {
      // H-2: Use api instance (sends httpOnly cookie automatically)
      const response = await api.post('/api/cds/extract-text', { transcript: text });
      const data = response.data;

      if (data.success && Object.keys(data.extracted_data).length > 0) {
        setExtractedData(data.extracted_data);
        setConfidence(data.confidence_score);
        setStatus('done');
      } else {
        setError('No clinical data could be extracted. Try speaking more clearly, e.g. "Dilation 5 cm, contractions 3 in 10 minutes".');
        setStatus('error');
      }
    } catch (err) {
      setError('Failed to connect to the AI extractor. Ensure the backend is running.');
      setStatus('error');
    }
  };

  const handleApply = () => {
    if (extractedData) {
      // Map NLP fields → form field names
      const mapped = {};
      if (extractedData.cervical_dilation_cm !== undefined)
        mapped.cervical_dilation = extractedData.cervical_dilation_cm;
      if (extractedData.fetal_head_station !== undefined)
        mapped.head_station = extractedData.fetal_head_station;
      if (extractedData.contraction_frequency_per_10min !== undefined)
        mapped.contraction_freq = extractedData.contraction_frequency_per_10min;
      if (extractedData.contraction_duration_sec !== undefined)
        mapped.contraction_duration = extractedData.contraction_duration_sec;
      if (extractedData.fetal_heart_rate !== undefined)
        mapped.fetal_heart_rate = extractedData.fetal_heart_rate;
      if (extractedData.maternal_pulse !== undefined)
        mapped.maternal_pulse = extractedData.maternal_pulse;
      if (extractedData.membrane_status !== undefined && extractedData.membrane_status === 'ruptured')
        mapped.amniotic_fluid = 'clear'; // surface-level flag (user can refine)

      onDataExtracted(mapped);
      onClose();
    }
  };

  const reset = () => {
    setStatus('idle');
    setTranscript('');
    setInterimText('');
    setExtractedData(null);
    setConfidence(null);
    setError('');
  };

  // ── Field label map for display ───────────────────────────────────
  const fieldLabels = {
    cervical_dilation_cm: 'Cervical Dilation',
    fetal_head_station: 'Head Station',
    contraction_frequency_per_10min: 'Contractions / 10 min',
    contraction_duration_sec: 'Contraction Duration (sec)',
    fetal_heart_rate: 'Fetal Heart Rate',
    maternal_pulse: 'Maternal Pulse',
    membrane_status: 'Membrane Status',
    time_hours: 'Time (hours)',
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0A0F1E]/85 backdrop-blur-md" onClick={onClose} />

      <div className="glass-card w-full max-w-lg relative z-10 flex flex-col animate-in fade-in zoom-in duration-300 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00C9A7] to-blue-500 flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Voice Input</h3>
              <p className="text-[11px] text-slate-400">Speak naturally — AI extracts clinical data</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-400 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col space-y-5">
          {/* Example phrase */}
          {status === 'idle' && (
            <div className="bg-[#0f172a] rounded-xl p-4 border border-white/5 text-xs text-slate-400 leading-relaxed">
              <p className="text-slate-300 font-semibold mb-2">Example phrase:</p>
              <em>"Dilation five point five cm, contractions three in ten minutes lasting forty seconds, head at minus two station, FHR one forty bpm"</em>
            </div>
          )}

          {/* Listening animation */}
          {status === 'listening' && (
            <div className="flex flex-col items-center space-y-4 py-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-pulse">
                  <Mic className="w-7 h-7 text-red-400" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              </div>
              <p className="text-white font-semibold">Listening — speak your observation...</p>
              {interimText && (
                <p className="text-slate-400 text-sm italic text-center max-w-xs">"{interimText}"</p>
              )}
              <button
                onClick={stopListening}
                className="flex items-center space-x-2 px-5 py-2 bg-red-500/20 border border-red-500/40 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/30 transition-colors cursor-pointer"
              >
                <MicOff className="w-4 h-4" />
                <span>Stop Recording</span>
              </button>
            </div>
          )}

          {/* Processing */}
          {status === 'processing' && (
            <div className="flex flex-col items-center space-y-3 py-6">
              <Loader2 className="w-8 h-8 text-[#00C9A7] animate-spin" />
              <p className="text-slate-300 text-sm">Extracting clinical data with AI...</p>
              {transcript && (
                <p className="text-slate-500 text-xs italic text-center max-w-xs">"{transcript}"</p>
              )}
            </div>
          )}

          {/* Results */}
          {status === 'done' && extractedData && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-[#00C9A7]">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold text-sm">Extraction Complete</span>
                <span className="ml-auto text-xs text-slate-400">Confidence: <span className="text-white font-bold">{Math.round(confidence * 100)}%</span></span>
              </div>

              <div className="bg-[#0f172a] rounded-xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                {Object.entries(extractedData).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-slate-400 text-xs">{fieldLabels[key] || key}</span>
                    <span className="text-white font-semibold font-mono">{String(value)}</span>
                  </div>
                ))}
              </div>

              {transcript && (
                <p className="text-xs text-slate-500 italic">Transcript: "{transcript}"</p>
              )}

              <p className="text-[10px] text-slate-500 text-center italic">
                AI-assisted input — verify values before saving
              </p>

              <div className="flex space-x-3">
                <button onClick={reset} className="flex-1 py-2.5 text-slate-400 hover:text-white border border-white/10 rounded-xl text-sm transition-colors cursor-pointer">
                  Try Again
                </button>
                <button onClick={handleApply} className="flex-1 py-2.5 bg-gradient-to-r from-[#00C9A7] to-blue-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer">
                  Apply to Form
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start space-x-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
              <button onClick={reset} className="w-full py-2.5 text-slate-400 hover:text-white border border-white/10 rounded-xl text-sm transition-colors cursor-pointer">
                Try Again
              </button>
            </div>
          )}

          {/* Start button (idle state) */}
          {status === 'idle' && (
            <>
              {!isSupported && (
                <p className="text-yellow-400 text-xs text-center flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Web Speech API not supported. Please use Chrome or Edge.
                </p>
              )}
              <button
                onClick={startListening}
                disabled={!isSupported}
                className="w-full flex items-center justify-center space-x-3 py-3.5 bg-gradient-to-r from-[#00C9A7] to-blue-500 text-white rounded-xl font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Mic className="w-5 h-5" />
                <span>Start Voice Input</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
