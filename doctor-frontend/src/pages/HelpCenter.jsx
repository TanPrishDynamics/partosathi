import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import FAQAccordion from '../components/FAQAccordion';
import { CATEGORIES, QUICK_ACTIONS, FAQ_DATA } from '../data/helpContent';
import { Search, HelpCircle, Zap, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const HelpCenter = () => {
  const [activeTab, setActiveTab]           = useState('help');
  const [searchQuery, setSearchQuery]       = useState('');
  const [activeCategory, setActiveCategory] = useState(null);

  const handleSearch = e => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim()) setActiveTab('faq');
  };

  const handleCategoryCard = id => {
    setActiveCategory(id);
    setSearchQuery('');
    setActiveTab('faq');
  };

  const handleQuickAction = q => {
    setSearchQuery(q);
    setActiveCategory(null);
    setActiveTab('faq');
  };

  const visibleSections = FAQ_DATA.filter(
    section => !activeCategory || section.categoryId === activeCategory
  );

  const totalResults = visibleSections.reduce((acc, section) => {
    const filtered = section.faqs.filter(({ question, answer }) => {
      if (!searchQuery) return true;
      const sq = searchQuery.toLowerCase();
      const inQ = question.toLowerCase().includes(sq);
      const inA = Array.isArray(answer)
        ? answer.some(a => a.toLowerCase().includes(sq))
        : answer.toLowerCase().includes(sq);
      return inQ || inA;
    });
    return acc + filtered.length;
  }, 0);

  /* ── Colour tokens ── */
  const blue   = '#2563EB';
  const blueLt = '#EFF6FF';
  const blueMd = '#BFDBFE';
  const slate  = '#111827';
  const muted  = '#6B7280';
  const border = '#E5E7EB';
  const bg     = '#F5F7FA';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: bg, fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}
        >
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
            background: blueLt,
            border: `1px solid ${blueMd}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HelpCircle style={{ width: '20px', height: '20px', color: blue }} />
          </div>
          <div>
            <h1 style={{
              margin: 0, fontSize: '20px', fontWeight: 700,
              color: slate, letterSpacing: '-0.01em', lineHeight: 1.2,
            }}>
              Help Center
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: muted }}>
              Find answers, guides, and clinical references
            </p>
          </div>
        </motion.div>

        {/* ── Search bar ──────────────────────────────────────────────── */}
        <div style={{
          background: '#fff',
          border: `1px solid ${border}`,
          borderRadius: '12px',
          padding: '11px 16px',
          display: 'flex', alignItems: 'center', gap: '10px',
          marginBottom: '20px',
          boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
        }}>
          <Search style={{ width: '15px', height: '15px', color: '#94A3B8', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search guides and FAQs…"
            value={searchQuery}
            onChange={handleSearch}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: '14px', color: slate,
              fontFamily: 'Inter, sans-serif',
            }}
          />
          {searchQuery && (
            <span style={{
              fontSize: '11px', color: blue, fontWeight: 700,
              background: blueLt,
              border: `1px solid ${blueMd}`,
              padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap',
            }}>
              {totalResults} result{totalResults !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Tab switcher ────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: '4px', marginBottom: '24px',
          background: '#fff',
          border: `1px solid ${border}`,
          borderRadius: '10px', padding: '4px', width: 'fit-content',
          boxShadow: '0 1px 4px rgba(15,23,42,0.04)',
        }}>
          {[
            { id: 'help', label: 'Help Center' },
            { id: 'faq',  label: 'Frequently Asked Questions' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '8px 18px', border: 'none', cursor: 'pointer',
                borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.18s ease',
                background: activeTab === t.id ? blue : 'transparent',
                color: activeTab === t.id ? '#fff' : muted,
                boxShadow: activeTab === t.id ? '0 1px 4px rgba(37,99,235,0.15)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Help Center ────────────────────────────────────────── */}
        {activeTab === 'help' && (
          <>
            <p style={{
              fontSize: '10px', fontWeight: 700, color: muted,
              textTransform: 'uppercase', letterSpacing: '0.12em',
              margin: '0 0 12px',
            }}>
              Browse by Category
            </p>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px', marginBottom: '32px',
            }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryCard(cat.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '16px 18px', borderRadius: '12px',
                    background: '#fff',
                    border: `1px solid ${border}`,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    boxShadow: '0 1px 4px rgba(15,23,42,0.04)',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.borderColor = '#BFDBFE';
                    e.currentTarget.style.boxShadow  = '0 2px 8px rgba(37,99,235,0.08)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.borderColor = border;
                    e.currentTarget.style.boxShadow  = '0 1px 4px rgba(15,23,42,0.04)';
                  }}
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                    background: blueLt,
                    border: `1px solid ${blueMd}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px',
                  }}>
                    {cat.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px', fontWeight: 600, color: slate,
                      marginBottom: '3px',
                    }}>
                      {cat.label}
                    </div>
                    <div style={{
                      fontSize: '12px', color: muted, lineHeight: 1.45,
                    }}>
                      {cat.desc}
                    </div>
                  </div>
                  <ChevronRight style={{ width: '14px', height: '14px', color: '#94A3B8', flexShrink: 0 }} />
                </button>
              ))}
            </div>

            <p style={{
              fontSize: '10px', fontWeight: 700, color: muted,
              textTransform: 'uppercase', letterSpacing: '0.12em',
              margin: '0 0 12px',
            }}>
              Quick Answers
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {QUICK_ACTIONS.map((qa, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickAction(qa.q)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', borderRadius: '20px',
                    background: '#fff',
                    border: `1px solid ${border}`,
                    cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                    color: muted, fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.background    = blueLt;
                    e.currentTarget.style.color         = blue;
                    e.currentTarget.style.borderColor   = '#BFDBFE';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background    = '#fff';
                    e.currentTarget.style.color         = muted;
                    e.currentTarget.style.borderColor   = border;
                  }}
                >
                  <Zap style={{ width: '11px', height: '11px', color: blue, flexShrink: 0 }} />
                  {qa.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Tab: FAQ ────────────────────────────────────────────────── */}
        {activeTab === 'faq' && (
          <>
            {/* Category filter pills */}
            <div style={{
              display: 'flex', gap: '6px', overflowX: 'auto',
              paddingBottom: '4px', marginBottom: '20px',
            }}>
              <button
                onClick={() => setActiveCategory(null)}
                style={{
                  padding: '5px 14px', borderRadius: '20px',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease', border: '1px solid',
                  background: !activeCategory ? blue : '#fff',
                  color: !activeCategory ? '#fff' : muted,
                  borderColor: !activeCategory ? blue : border,
                }}
              >
                All Topics
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                  style={{
                    padding: '5px 14px', borderRadius: '20px',
                    cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                    fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    background: activeCategory === cat.id ? blueLt : '#fff',
                    color: activeCategory === cat.id ? blue : muted,
                    border: `1px solid ${activeCategory === cat.id ? '#BFDBFE' : border}`,
                  }}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>

            {/* FAQ sections */}
            {visibleSections.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px',
                color: muted, fontSize: '14px',
              }}>
                No results found for "{searchQuery}"
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                {visibleSections.map(section => (
                  <div key={section.categoryId}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '16px' }}>
                        {CATEGORIES.find(c => c.id === section.categoryId)?.icon}
                      </span>
                      <h2 style={{
                        margin: 0, fontSize: '14px', fontWeight: 600,
                        color: slate,
                      }}>
                        {section.category}
                      </h2>
                    </div>
                    <FAQAccordion faqs={section.faqs} searchQuery={searchQuery} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default HelpCenter;
