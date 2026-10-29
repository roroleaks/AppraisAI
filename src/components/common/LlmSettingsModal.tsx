'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Key, Check, Shield, X, Sparkles, ExternalLink } from 'lucide-react';
import { useAppraisalStore } from '@/store/useAppraisalStore';
import { LlmProvider } from '@/lib/llm/llm-client';

const FREE_PROVIDER_INFO = {
  gemini: {
    name: 'Google Gemini (Free Tier)',
    recommendedModel: 'gemini-2.5-flash',
    portalUrl: 'https://aistudio.google.com/app/apikey',
    badge: '15 RPM Free Tier',
  },
  groq: {
    name: 'Groq Cloud (Fast & Free)',
    recommendedModel: 'llama-3.3-70b-versatile',
    portalUrl: 'https://console.groq.com/keys',
    badge: 'Free Tier Available',
  },
  openai: {
    name: 'OpenAI API',
    recommendedModel: 'gpt-4o-mini',
    portalUrl: 'https://platform.openai.com/api-keys',
    badge: 'Pay-As-You-Go',
  },
};

export const LlmSettingsModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { llmProvider, llmApiKey, llmModel, setLlmConfig } = useAppraisalStore();

  const [provider, setProvider] = useState<LlmProvider>(llmProvider);
  const [apiKey, setApiKey] = useState(llmApiKey);
  const [model, setModel] = useState(llmModel);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Load from localStorage if present
    const savedProvider = localStorage.getItem('appraisai_llm_provider') as LlmProvider | null;
    const savedKey = localStorage.getItem('appraisai_llm_key');
    const savedModel = localStorage.getItem('appraisai_llm_model');

    if (savedProvider) setProvider(savedProvider);
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setModel(savedModel);

    if (savedProvider || savedKey) {
      setLlmConfig(
        savedProvider || 'gemini',
        savedKey || '',
        savedModel || (savedProvider === 'groq' ? 'llama-3.3-70b-versatile' : 'gemini-2.5-flash')
      );
    }
  }, [setLlmConfig]);

  const handleSave = () => {
    localStorage.setItem('appraisai_llm_provider', provider);
    localStorage.setItem('appraisai_llm_key', apiKey.trim());
    localStorage.setItem('appraisai_llm_model', model.trim());

    setLlmConfig(provider, apiKey.trim(), model.trim());
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      setIsOpen(false);
    }, 800);
  };

  const handleProviderChange = (newProvider: LlmProvider) => {
    setProvider(newProvider);
    if (newProvider === 'gemini') setModel('gemini-2.5-flash');
    else if (newProvider === 'groq') setModel('llama-3.3-70b-versatile');
    else if (newProvider === 'openai') setModel('gpt-4o-mini');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg border border-white/20 transition-colors shadow-xs"
      >
        <Settings className="w-3.5 h-3.5 text-teal-200" />
        LLM Provider
        {apiKey ? (
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block ml-0.5" title="Custom API Key Active" />
        ) : (
          <span className="text-[10px] bg-teal-800/80 text-teal-100 px-1.5 py-0.2 rounded font-normal">
            Deterministic Active
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-teal-700" />
                <h3 className="font-serif font-bold text-slate-900 text-base">LLM Provider & API Keys</h3>
              </div>
              <button onClick={() => setIsOpen(false)} aria-label="Close settings" className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-900 space-y-1">
              <p className="font-semibold flex items-center gap-1 text-teal-950">
                <Sparkles className="w-3.5 h-3.5 text-teal-700" /> Zero-Friction Deterministic Engine Included
              </p>
              <p className="text-[11px] leading-relaxed">
                If you do not enter an API key, AppraisAI automatically uses its built-in rule-based 
                methodological appraisal engine. You can also paste a completely free API key below for deep neural synthesis.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Engine Provider</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['gemini', 'groq', 'openai'] as LlmProvider[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleProviderChange(p)}
                      className={`py-2 px-3 rounded-lg border text-center font-medium capitalize transition-all ${
                        provider === p
                          ? 'border-teal-700 bg-teal-50 text-teal-900 font-semibold shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">API Key ({provider.toUpperCase()})</label>
                  <a
                    href={FREE_PROVIDER_INFO[provider].portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-0.5 underline"
                  >
                    Get Free {provider.toUpperCase()} Key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Paste ${provider.toUpperCase()} API key...`}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 text-xs font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-slate-400" />
                  Stored only in your browser local storage. Never sent to any third-party server.
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Model Name</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 text-xs font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Recommended free model: <strong>{FREE_PROVIDER_INFO[provider].recommendedModel}</strong>
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                {isSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" /> Saved!
                  </>
                ) : (
                  'Apply Settings'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
