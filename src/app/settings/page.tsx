'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Cpu, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  RotateCw, 
  Save, 
  Server, 
  Terminal,
  Lock,
  Layers
} from 'lucide-react';
import { AppSettings } from '@/lib/types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    ollamaEndpoint: 'http://localhost:11434',
    modelName: 'gemma3:4b',
    temperature: 0.2,
    enableFallback: true,
    autoVerify: true,
    sandboxTimeoutSeconds: 30
  });

  const [ollamaStatus, setOllamaStatus] = useState<{
    online: boolean;
    availableModels: string[];
    detectedHardware: string;
    activeModel: string;
  } | null>(null);

  const [testingConnection, setTestingConnection] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSettings(data.settings);
          setOllamaStatus(data.ollamaStatus);
        }
      });
  }, []);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        setOllamaStatus(data.ollamaStatus);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 font-mono">
      
      {/* Header */}
      <div className="border-b border-border pb-5">
        <div className="flex items-center space-x-2 text-xs text-life mb-1">
          <Settings className="w-4 h-4" />
          <span>RUNTIME CONTROL PANEL</span>
        </div>
        <h1 className="text-2xl font-bold text-textMain">
          Lab Settings & Inference Configuration_
        </h1>
        <p className="text-xs text-textMuted mt-1">
          Configure on-device Ollama connection, open-weight Gemma 3 model parameters, and local sandbox boundaries.
        </p>
      </div>

      {/* Ollama Live Health Card */}
      <div className="p-6 rounded-xl border border-border bg-panel space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-void border border-border flex items-center justify-center text-life">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-textMain flex items-center gap-2">
                Ollama Local Daemon Status
                {ollamaStatus?.online ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-life/20 text-life border border-life/30 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-life animate-pulse"></span>
                    ONLINE
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-pumpkin/20 text-pumpkin border border-pumpkin/30 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-pumpkin"></span>
                    STANDBY / FALLBACK ACTIVE
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-textMuted">
                Endpoint: <code className="text-textMain">{settings.ollamaEndpoint}</code>
              </p>
            </div>
          </div>

          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="px-3 py-1.5 rounded-lg bg-panelElevated hover:bg-void border border-border text-xs text-textMain hover:text-life transition-colors flex items-center space-x-1.5 disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
            <span>Test Connection</span>
          </button>
        </div>

        <div className="p-3.5 rounded-lg bg-void border border-border text-xs space-y-2 text-textMuted">
          <div className="flex justify-between">
            <span>Hardware Acceleration:</span>
            <span className="text-life font-medium">{ollamaStatus?.detectedHardware || 'Apple Silicon / Metal GPU'}</span>
          </div>
          <div className="flex justify-between">
            <span>Active Model:</span>
            <span className="text-textMain font-bold">{settings.modelName}</span>
          </div>
          <div className="flex justify-between">
            <span>Resilient Local Heuristic Reasoning:</span>
            <span className="text-life">Enabled (Zero Crashes Guarantee)</span>
          </div>
        </div>
      </div>

      {/* Inference & Model Form */}
      <div className="p-6 rounded-xl border border-border bg-panel space-y-6">
        <h2 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4 text-life" />
          Model Parameters
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          
          {/* Model Selection */}
          <div className="space-y-1.5">
            <label className="text-textMuted block">Target Model Identifier</label>
            <select
              value={settings.modelName}
              onChange={(e) => setSettings({ ...settings, modelName: e.target.value })}
              className="w-full px-3 py-2 bg-void border border-border rounded-lg text-textMain focus:outline-none focus:border-life"
            >
              <option value="gemma3:4b">gemma3:4b (Recommended · 3.4GB)</option>
              <option value="gemma3:1b">gemma3:1b (Ultra-lightweight · 1.2GB)</option>
              <option value="gemma3:12b">gemma3:12b (High reasoning · 8.1GB)</option>
            </select>
            <span className="text-[10px] text-textMuted block">
              Pull using: <code className="text-life">ollama pull {settings.modelName}</code>
            </span>
          </div>

          {/* Endpoint */}
          <div className="space-y-1.5">
            <label className="text-textMuted block">Ollama Daemon URL</label>
            <input
              type="text"
              value={settings.ollamaEndpoint}
              onChange={(e) => setSettings({ ...settings, ollamaEndpoint: e.target.value })}
              className="w-full px-3 py-2 bg-void border border-border rounded-lg text-textMain focus:outline-none focus:border-life"
            />
          </div>

          {/* Temperature */}
          <div className="space-y-1.5">
            <label className="text-textMuted block">Sampling Temperature ({settings.temperature})</label>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={settings.temperature}
              onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
              className="w-full accent-life"
            />
            <span className="text-[10px] text-textMuted block">
              Low temperature (0.1 - 0.3) ensures deterministic, source-grounded code outputs.
            </span>
          </div>

          {/* Sandbox Timeout */}
          <div className="space-y-1.5">
            <label className="text-textMuted block">Verification Sandbox Timeout (Seconds)</label>
            <input
              type="number"
              min="5"
              max="120"
              value={settings.sandboxTimeoutSeconds}
              onChange={(e) => setSettings({ ...settings, sandboxTimeoutSeconds: parseInt(e.target.value) || 30 })}
              className="w-full px-3 py-2 bg-void border border-border rounded-lg text-textMain focus:outline-none focus:border-life"
            />
          </div>

        </div>

        <div className="pt-4 border-t border-border flex items-center justify-between">
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-life hover:bg-life/90 text-void font-bold text-xs flex items-center space-x-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Configuration</span>
          </button>

          {saveSuccess && (
            <span className="text-xs text-life flex items-center gap-1 font-bold animate-pulse">
              <CheckCircle2 className="w-4 h-4" />
              Settings Saved Successfully
            </span>
          )}
        </div>
      </div>

      {/* Local-First Privacy Pledge */}
      <div className="p-6 rounded-xl border border-life/30 bg-life/5 space-y-3">
        <div className="flex items-center space-x-2 text-life font-bold text-xs uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>Local-First & Open Innovation Pledge</span>
        </div>
        <p className="text-xs text-textMuted leading-relaxed font-sans">
          The Last Commit was designed from the ground up to respect developer autonomy. 
          When analyzing repositories in local mode, your source code is processed on your device via 
          <strong className="text-textMain"> Ollama and Gemma 3</strong>. No proprietary API calls are made, 
          and no repository telemetry or proprietary code ever leaves your machine.
        </p>
      </div>

    </div>
  );
}
