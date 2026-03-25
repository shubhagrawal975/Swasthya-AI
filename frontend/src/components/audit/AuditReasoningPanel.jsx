import React, { useState } from 'react';

const SEVERITY_CONFIG = {
  critical: { bg: '#fde8e8', border: '#fc8181', color: '#c53030', icon: '🚨' },
  high:     { bg: '#fff5f5', border: '#fed7d7', color: '#e53e3e', icon: '⚠️' },
  medium:   { bg: '#fef3dc', border: '#f6c46a', color: '#92600a', icon: '⚡' },
  low:      { bg: '#ebf4ff', border: '#bee3f8', color: '#2b6cb0', icon: 'ℹ️' },
  info:     { bg: '#f0f9f4', border: '#b0d8c0', color: '#276749', icon: '📋' },
  warning:  { bg: '#fef3dc', border: '#f6c46a', color: '#92600a', icon: '⚡' },
};

const DECISION_CONFIG = {
  approved:          { bg: '#e6f4ec', color: '#276749',  icon: '✅', label: 'Approved' },
  approve:           { bg: '#e6f4ec', color: '#276749',  icon: '✅', label: 'Approved' },
  denied:            { bg: '#fde8e8', color: '#c53030',  icon: '❌', label: 'Denied' },
  deny:              { bg: '#fde8e8', color: '#c53030',  icon: '❌', label: 'Denied' },
  more_info_needed:  { bg: '#fef3dc', color: '#92600a',  icon: '📋', label: 'More Info Needed' },
  more_info_requested:{ bg: '#fef3dc', color: '#92600a', icon: '📋', label: 'Info Requested' },
  request_more_info: { bg: '#fef3dc', color: '#92600a',  icon: '📋', label: 'Info Required' },
  escalated:         { bg: '#ebf4ff', color: '#2b6cb0',  icon: '🔼', label: 'Escalated' },
  escalate:          { bg: '#ebf4ff', color: '#2b6cb0',  icon: '🔼', label: 'Escalate' },
  pend:              { bg: '#edf2f7', color: '#4a5568',   icon: '⏸️', label: 'Pending' },
  pending:           { bg: '#edf2f7', color: '#4a5568',   icon: '⏸️', label: 'Pending' },
  human_review:      { bg: '#fef3dc', color: '#92600a',  icon: '👨‍⚕️', label: 'Human Review' },
  ai_processed:      { bg: '#f0f9f4', color: '#276749',  icon: '🤖', label: 'AI Processed' },
  overridden:        { bg: '#f0ebff', color: '#6b46c1',  icon: '🔄', label: 'Overridden' },
};

export function DecisionBadge({ decision, size = 'sm' }) {
  const cfg = DECISION_CONFIG[decision] || { bg: '#edf2f7', color: '#4a5568', icon: '❓', label: decision };
  return (
    <span className={`inline-flex items-center gap-1 font-bold rounded-full ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1'}`}
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

export function ConfidenceBar({ confidence, showLabel = true }) {
  const pct = parseFloat(confidence) || 0;
  const color = pct >= 80 ? '#38a169' : pct >= 60 ? '#d69e2e' : '#e53e3e';
  return (
    <div>
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#5a7065' }}>Confidence</span>
          <span className="text-xs font-extrabold" style={{ color }}>{pct.toFixed(1)}%</span>
        </div>
      )}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#edf1e8' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export function FlagsList({ flags = [], maxShow = 5 }) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? flags : flags.slice(0, maxShow);
  if (!flags.length) return <div className="text-xs italic" style={{ color: '#a0b0a5' }}>No flags raised</div>;

  return (
    <div className="space-y-1.5">
      {display.map((flag, i) => {
        const cfg = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.info;
        return (
          <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-xl"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            <span className="text-sm mt-0.5 flex-shrink-0">{cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: cfg.color }}>{flag.type?.replace(/_/g,' ')}</div>
              <div className="text-xs leading-relaxed mt-0.5" style={{ color: cfg.color }}>{flag.message}</div>
            </div>
          </div>
        );
      })}
      {flags.length > maxShow && (
        <button onClick={() => setExpanded(!expanded)} className="text-[10px] font-bold" style={{ color: '#1a5c3a' }}>
          {expanded ? 'Show less' : `+ ${flags.length - maxShow} more flags`}
        </button>
      )}
    </div>
  );
}

export function StepTimeline({ steps = [] }) {
  if (!steps.length) return <div className="text-xs italic" style={{ color: '#a0b0a5' }}>No steps recorded</div>;
  return (
    <div className="relative">
      <div className="absolute left-3.5 top-0 bottom-0 w-0.5" style={{ background: '#dde8e1' }} />
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 relative z-10"
              style={{ background: i === steps.length - 1 ? '#1a5c3a' : '#b0d8c0' }}>
              {i + 1}
            </div>
            <div className="flex-1 pb-1">
              <div className="text-xs font-bold" style={{ color: '#0d1e35' }}>{step.step?.replace(/_/g, ' ')}</div>
              {step.timestamp && <div className="text-[10px] mt-0.5" style={{ color: '#a0b0a5' }}>{new Date(step.timestamp).toLocaleTimeString()}</div>}
              {step.details && <div className="text-[10px] mt-0.5" style={{ color: '#5a7065' }}>{JSON.stringify(step.details)}</div>}
              {step.result && <div className="text-[10px] mt-0.5 font-semibold" style={{ color: step.result==='PASS'?'#276749':'#c53030' }}>{step.result}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CriteriaChecklist({ criteria = [] }) {
  if (!criteria.length) return <div className="text-xs italic" style={{ color: '#a0b0a5' }}>No criteria evaluated</div>;
  const met = criteria.filter(c => c.met).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold" style={{ color: '#5a7065' }}>Criteria: {met}/{criteria.length} met</span>
        <div className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: met === criteria.length ? '#e6f4ec' : '#fde8e8', color: met === criteria.length ? '#276749' : '#c53030' }}>
          {met === criteria.length ? '✅ All Met' : `${criteria.length - met} Unmet`}
        </div>
      </div>
      <div className="space-y-1.5">
        {criteria.map((c, i) => (
          <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl"
            style={{ background: c.met ? '#f0f9f4' : '#fff5f5', border: `1px solid ${c.met ? '#b0d8c0' : '#fed7d7'}` }}>
            <span className="text-base flex-shrink-0">{c.met ? '✅' : '❌'}</span>
            <div className="flex-1">
              <div className="text-xs font-bold" style={{ color: c.met ? '#276749' : '#c53030' }}>{c.label}</div>
              {c.evidence && <div className="text-[10px] mt-0.5" style={{ color: '#5a7065' }}>Evidence: {c.evidence}</div>}
            </div>
            {c.required && !c.met && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: '#fde8e8', color: '#c53030' }}>Required</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Main AuditReasoningPanel component
 * Shows full structured audit trail for any ops case
 */
export default function AuditReasoningPanel({ caseData, caseType = 'coding', compact = false }) {
  const [activeTab, setActiveTab] = useState('decision');

  if (!caseData) return null;

  const {
    case_ref, status, decision, decision_confidence, overall_confidence,
    compliance_flags = [], suggested_codes = [], criteria_checklist = [],
    missing_evidence = [], audit_trail = [], steps_executed = [], validations_run = [],
    policy_refs = [], flags = [],
    audit_reasoning = {}, decision_reasoning,
    human_review_required, reviewer_action, reviewer_notes, reviewer_justification, reviewed_at,
  } = caseData;

  const confidence = decision_confidence || overall_confidence || 0;
  const allFlags = [...(compliance_flags || []), ...(flags || [])];
  const allSteps = steps_executed.length ? steps_executed : (audit_reasoning?.steps_executed || []);
  const allValidations = validations_run.length ? validations_run : (audit_reasoning?.validations_run || []);

  const TABS = [
    { id: 'decision', label: '🎯 Decision', count: null },
    { id: 'criteria', label: '📋 Criteria', count: criteria_checklist.length || null },
    { id: 'flags',    label: '🚩 Flags',    count: allFlags.length || null },
    { id: 'steps',    label: '📊 Steps',    count: allSteps.length || null },
    { id: 'audit',    label: '📜 Audit Trail', count: null },
    ...(suggested_codes.length ? [{ id: 'codes', label: '💊 Codes', count: suggested_codes.length }] : []),
  ];

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1.5px solid #dde8e1', boxShadow: '0 4px 20px rgba(26,92,58,.08)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#f0f9f4', borderBottom: '1px solid #dde8e1' }}>
        <div className="flex items-center gap-3">
          <div className="text-lg">🏥</div>
          <div>
            <div className="font-bold text-sm" style={{ color: '#0d1e35' }}>Audit Reasoning Panel</div>
            {case_ref && <div className="text-[10px] font-mono mt-0.5" style={{ color: '#5a7065' }}>Case: {case_ref}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(decision || status) && <DecisionBadge decision={decision || status} />}
          {human_review_required && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#fef3dc', color: '#92600a' }}>
              👨‍⚕️ Human Review Required
            </span>
          )}
        </div>
      </div>

      {/* Confidence bar */}
      {confidence > 0 && (
        <div className="px-4 py-2" style={{ background: '#fafcfa', borderBottom: '1px solid #dde8e1' }}>
          <ConfidenceBar confidence={confidence} />
        </div>
      )}

      {/* Tab bar */}
      <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid #dde8e1', scrollbarWidth: 'none' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex-shrink-0 flex items-center gap-1 px-4 py-2.5 text-xs font-bold transition-all"
            style={{
              borderBottom: activeTab === tab.id ? '2px solid #1a5c3a' : '2px solid transparent',
              color: activeTab === tab.id ? '#1a5c3a' : '#5a7065',
              background: 'transparent',
            }}>
            {tab.label}
            {tab.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black"
                style={{ background: '#1a5c3a', color: '#fff' }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">

        {/* Decision tab */}
        {activeTab === 'decision' && (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#5a7065' }}>Primary Decision</div>
              <div className="p-3 rounded-xl" style={{ background: (DECISION_CONFIG[decision]?.bg || '#f4f7f2') }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{DECISION_CONFIG[decision]?.icon || '❓'}</span>
                  <span className="font-bold" style={{ color: DECISION_CONFIG[decision]?.color || '#5a7065' }}>
                    {DECISION_CONFIG[decision]?.label || decision}
                  </span>
                </div>
                {(decision_reasoning || audit_reasoning?.human_review_reasons?.[0]) && (
                  <div className="text-xs leading-relaxed mt-1" style={{ color: '#5a7065' }}>
                    {decision_reasoning || audit_reasoning.human_review_reasons.join(' | ')}
                  </div>
                )}
              </div>
            </div>

            {/* Policy note */}
            {(audit_reasoning?.policy_note || audit_reasoning?.disclaimer) && (
              <div className="p-3 rounded-xl text-xs leading-relaxed" style={{ background: '#f0f9f4', border: '1px solid #b0d8c0', color: '#276749' }}>
                📋 {audit_reasoning.policy_note || audit_reasoning.disclaimer}
              </div>
            )}

            {/* Agent info */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {audit_reasoning?.agent && (
                <div className="p-2.5 rounded-xl" style={{ background: '#f4f7f2' }}>
                  <div className="font-bold mb-0.5" style={{ color: '#5a7065' }}>Agent</div>
                  <div className="font-mono text-[10px]" style={{ color: '#0d1e35' }}>{audit_reasoning.agent}</div>
                </div>
              )}
              {audit_reasoning?.processing_time_ms && (
                <div className="p-2.5 rounded-xl" style={{ background: '#f4f7f2' }}>
                  <div className="font-bold mb-0.5" style={{ color: '#5a7065' }}>Processing Time</div>
                  <div style={{ color: '#0d1e35' }}>{audit_reasoning.processing_time_ms}ms</div>
                </div>
              )}
              {audit_reasoning?.entity_extraction_method && (
                <div className="p-2.5 rounded-xl" style={{ background: '#f4f7f2' }}>
                  <div className="font-bold mb-0.5" style={{ color: '#5a7065' }}>Extraction Method</div>
                  <div style={{ color: '#0d1e35' }}>{audit_reasoning.entity_extraction_method}</div>
                </div>
              )}
              {audit_reasoning?.code_matching_method && (
                <div className="p-2.5 rounded-xl" style={{ background: '#f4f7f2' }}>
                  <div className="font-bold mb-0.5" style={{ color: '#5a7065' }}>Code Matching</div>
                  <div style={{ color: '#0d1e35' }}>{audit_reasoning.code_matching_method}</div>
                </div>
              )}
            </div>

            {/* Reviewer action */}
            {reviewer_action && (
              <div className="p-3 rounded-xl" style={{ background: '#ebf4ff', border: '1px solid #bee3f8' }}>
                <div className="font-bold text-xs mb-1" style={{ color: '#2b6cb0' }}>
                  👨‍⚕️ Human Review — {reviewer_action}
                </div>
                {reviewer_notes && <div className="text-xs" style={{ color: '#3a6fa8' }}>Notes: {reviewer_notes}</div>}
                {reviewer_justification && <div className="text-xs mt-1 font-semibold" style={{ color: '#2b6cb0' }}>Justification: {reviewer_justification}</div>}
                {reviewed_at && <div className="text-[10px] mt-1" style={{ color: '#a0b0a5' }}>{new Date(reviewed_at).toLocaleString()}</div>}
              </div>
            )}
          </div>
        )}

        {/* Criteria tab */}
        {activeTab === 'criteria' && (
          <div className="space-y-4">
            <CriteriaChecklist criteria={criteria_checklist} />
            {missing_evidence.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#c53030' }}>Missing Evidence / Required Actions</div>
                <div className="space-y-1.5">
                  {missing_evidence.map((m, i) => (
                    <div key={i} className="px-3 py-2 rounded-xl text-xs" style={{ background: '#fff5f5', border: '1px solid #fed7d7', color: '#c53030' }}>
                      <strong>{(m.criterion || m).replace(/_/g,' ')}</strong>
                      {m.action_required && <span className="ml-2 text-[10px]">→ {m.action_required}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Flags tab */}
        {activeTab === 'flags' && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#5a7065' }}>
              {allFlags.length} Flag(s) Raised
            </div>
            <FlagsList flags={allFlags} maxShow={20} />
            {allValidations.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#5a7065' }}>Validations Run</div>
                <div className="space-y-1.5">
                  {allValidations.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                      style={{ background: v.passed ? '#f0f9f4' : '#fff5f5' }}>
                      <span>{v.passed ? '✅' : '❌'}</span>
                      <span className="flex-1 font-semibold" style={{ color: '#1a2e1f' }}>{v.check?.replace(/_/g,' ')}</span>
                      {v.result && <span className="text-[10px] font-bold" style={{ color: v.passed ? '#276749' : '#c53030' }}>{v.result}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Steps tab */}
        {activeTab === 'steps' && <StepTimeline steps={allSteps} />}

        {/* Audit trail tab */}
        {activeTab === 'audit' && (
          <div>
            {audit_trail.length === 0 ? (
              <div className="text-xs italic text-center py-6" style={{ color: '#a0b0a5' }}>No audit trail recorded</div>
            ) : (
              <div className="space-y-2">
                {(Array.isArray(audit_trail) ? audit_trail : []).map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl" style={{ background: '#f4f7f2', border: '1px solid #dde8e1' }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: '#1a5c3a' }}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold" style={{ color: '#0d1e35' }}>{entry.event?.replace(/_/g,' ')}</span>
                        {entry.timestamp && <span className="text-[10px]" style={{ color: '#a0b0a5' }}>{new Date(entry.timestamp).toLocaleTimeString()}</span>}
                      </div>
                      {entry.actor && <div className="text-[10px] mt-0.5" style={{ color: '#5a7065' }}>Actor: {entry.actor}</div>}
                      {entry.result && <div className="text-[10px] mt-0.5 font-semibold" style={{ color: entry.result==='PASS'||entry.result==='CLEAR'?'#276749':'#c53030' }}>{entry.result}</div>}
                      {entry.decision && <div className="text-[10px] mt-0.5" style={{ color: '#5a7065' }}>Decision: {entry.decision} ({(entry.confidence*100).toFixed(0)}% confidence)</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Codes tab */}
        {activeTab === 'codes' && suggested_codes.length > 0 && (
          <div className="space-y-2">
            {suggested_codes.map((code, i) => (
              <div key={i} className="p-3 rounded-xl" style={{ background: '#f4f7f2', border: '1.5px solid #dde8e1' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: code.type==='ICD10'?'#ebf4ff':'#f0ebff', color: code.type==='ICD10'?'#2b6cb0':'#6b46c1' }}>{code.type}</span>
                      <span className="font-mono font-bold text-sm" style={{ color: '#0d1e35' }}>{code.code}</span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: '#5a7065' }}>{code.description}</div>
                    {code.source_text && <div className="text-[10px] mt-1 italic" style={{ color: '#a0b0a5' }}>Source: "{code.source_text}"</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <ConfidenceBar confidence={code.confidence * 100} showLabel={false} />
                    <div className="text-[10px] mt-1 font-bold" style={{ color: code.confidence >= 0.7 ? '#276749' : '#e53e3e' }}>
                      {(code.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
                {code.flags?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {code.flags.map((f, fi) => (
                      <span key={fi} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#fef3dc', color: '#92600a' }}>{f.replace(/_/g,' ')}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="p-2.5 rounded-xl text-[10px] leading-relaxed text-center" style={{ background: '#fef3dc', border: '1px solid #f6c46a', color: '#92600a' }}>
              ⚠️ All codes are AI-suggested and require review by a licensed medical coder before use.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
