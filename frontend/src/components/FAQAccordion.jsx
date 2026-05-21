import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQAccordion = ({ faqs, searchQuery = '' }) => {
  const [openIndex, setOpenIndex] = useState(null);

  const filtered = faqs.filter(({ question, answer }) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const inQuestion = question.toLowerCase().includes(q);
    const inAnswer = Array.isArray(answer)
      ? answer.some(a => a.toLowerCase().includes(q))
      : answer.toLowerCase().includes(q);
    return inQuestion || inAnswer;
  });

  if (filtered.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '32px',
        color: '#9CA3AF', fontSize: '13px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        No results for "{searchQuery}"
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {filtered.map(({ question, answer }, i) => {
        const isOpen = openIndex === i;
        const lines = Array.isArray(answer) ? answer : [answer];
        return (
          <div
            key={i}
            style={{
              borderRadius: '8px',
              border: `1px solid ${isOpen ? '#BFDBFE' : '#E5E7EB'}`,
              background: isOpen ? '#EFF6FF' : '#FFFFFF',
              overflow: 'hidden',
              transition: 'border-color 0.15s ease, background 0.15s ease',
            }}
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: '12px',
                padding: '14px 18px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{
                fontSize: '13.5px', fontWeight: 600,
                color: isOpen ? '#2563EB' : '#111827',
                lineHeight: 1.45, fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'color 0.15s ease',
              }}>
                {question}
              </span>
              <ChevronDown
                style={{
                  width: '15px', height: '15px', flexShrink: 0,
                  color: isOpen ? '#2563EB' : '#9CA3AF',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease, color 0.15s ease',
                }}
              />
            </button>

            {isOpen && (
              <div style={{
                padding: '0 18px 16px',
                borderTop: '1px solid #DBEAFE',
              }}>
                <ul style={{ margin: '10px 0 0', padding: '0 0 0 16px' }}>
                  {lines.map((line, j) => (
                    <li key={j} style={{
                      fontSize: '13px', color: '#6B7280', lineHeight: 1.7,
                      fontFamily: 'Inter, system-ui, sans-serif', marginBottom: '4px',
                    }}>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FAQAccordion;
