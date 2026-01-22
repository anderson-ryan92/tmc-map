const { useState, useEffect } = React;

// Google Sheets configuration
const SHEET_ID = '18_cfhfJah0l0bOu4urB3Oj52Bx6HBKRZF-_8765OgoM';
const MILESTONES_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=milestones`;
const CONFIG_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=config`;

// Fallback data if Google Sheets fetch fails
const fallbackData = {
  lastUpdated: "2026-01-21",
  milestones: [
    { id: "start", type: "start", title: "START", status: "completed" },
    { id: "final-rule", type: "procedural", date: "2026-01-21", title: "FINAL RULE EFFECTIVE", subtitle: "Consolidated License Procedure", description: "Effective Date: Immediate", status: "current", details: { summary: "Loading data from Google Sheets..." } },
  ]
};

// =============================================================================
// Data Parsing Utilities
// =============================================================================

const parseSheetData = (text) => {
  const jsonString = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/)?.[1];
  if (!jsonString) return null;
  const data = JSON.parse(jsonString);
  const headers = data.table.cols.map(col => col.label);
  return data.table.rows.map(row => {
    const obj = {};
    row.c.forEach((cell, i) => { obj[headers[i]] = cell?.v ?? ''; });
    return obj;
  });
};

const transformMilestones = (rows) => {
  const parseDate = (d) => {
    if (!d) return null;
    if (typeof d === 'string' && d.startsWith('Date(')) {
      const m = d.match(/Date\((\d+),(\d+),(\d+)\)/);
      if (m) return `${m[1]}-${String(Number(m[2])+1).padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    }
    return d;
  };

  return rows.map(row => {
    const milestone = {
      id: row.id,
      type: row.type,
      date: parseDate(row.date),
      title: row.title,
      subtitle: row.subtitle || null,
      description: row.description || null,
      status: row.status,
      isRisk: row.isRisk === 'TRUE' || row.isRisk === true,
      isCatalyst: row.isCatalyst === 'TRUE' || row.isCatalyst === true,
      isOutcome: row.isOutcome === 'TRUE' || row.isOutcome === true,
      isStatutory: row.type === 'statutory',
      catalystOrder: row.catalystOrder ? parseInt(row.catalystOrder) : null
    };

    const details = {};
    Object.keys(row).forEach(key => {
      if (key.startsWith('details_') && row[key]) {
        const detailKey = key.replace('details_', '').replace(/_/g, '.');
        let value = row[key];
        if (typeof value === 'string' && value.includes('|')) {
          value = value.split('|').map(s => s.trim());
        }
        const keys = detailKey.split('.');
        if (keys.length === 1) {
          details[keys[0]] = value;
        } else {
          if (!details[keys[0]]) details[keys[0]] = {};
          details[keys[0]][keys[1]] = value;
        }
      }
    });

    if (Object.keys(details).length > 0) milestone.details = details;
    return milestone;
  }).filter(m => m.id);
};

// =============================================================================
// Helper Functions
// =============================================================================

const getColor = (type, isRisk, isCatalyst, isOutcome) => {
  if (isOutcome || isCatalyst) return { bg: 'var(--green)', dim: 'var(--green-dim)' };
  if (isRisk) return { bg: 'var(--red)', dim: 'var(--red-dim)' };
  if (type === 'statutory') return { bg: 'var(--yellow)', dim: 'var(--yellow-dim)' };
  if (type === 'conditional' || type === 'start') return { bg: 'var(--text-muted)', dim: 'var(--bg-tertiary)' };
  return { bg: 'var(--blue)', dim: 'var(--blue-dim)' };
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

const getDaysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;

// =============================================================================
// Components
// =============================================================================

const DetailPanel = ({ milestone, onClose }) => {
  if (!milestone?.details) return null;
  const color = getColor(milestone.type, milestone.isRisk, milestone.isCatalyst, milestone.isOutcome);
  const days = getDaysUntil(milestone.date);

  const renderValue = (value) => {
    if (Array.isArray(value)) {
      return (
        <ul style={{ listStyle: 'disc inside', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {value.map((item, i) => <li key={i} style={{ color: 'var(--text-secondary)' }}>{item}</li>)}
        </ul>
      );
    }
    if (typeof value === 'object' && value !== null) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(value).map(([k, v]) => (
            <div key={k}>
              <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}: </span>
              <span style={{ color: 'var(--text-secondary)' }}>{Array.isArray(v) ? v.join(', ') : v}</span>
            </div>
          ))}
        </div>
      );
    }
    return <span style={{ color: 'var(--text-secondary)' }}>{value}</span>;
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 40 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, height: '100%', width: '100%', maxWidth: '512px', background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 50, overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '24px', zIndex: 10 }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'JetBrains Mono', fontSize: '12px' }}>✕ Close</button>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
              {milestone.isRisk ? '⚠️' : milestone.isCatalyst ? '💰' : milestone.isStatutory ? '⚖️' : milestone.isOutcome ? '🎯' : '📋'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.3 }}>{milestone.title}</h2>
              {milestone.subtitle && <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>{milestone.subtitle}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
            {milestone.date && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDate(milestone.date)}, 2026</span>
              </div>
            )}
            {days > 0 && (
              <div style={{ padding: '6px 12px', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '13px', fontWeight: 600, background: days <= 7 ? 'var(--red-dim)' : days <= 14 ? 'var(--yellow-dim)' : 'var(--blue-dim)', color: days <= 7 ? 'var(--red)' : days <= 14 ? 'var(--yellow)' : 'var(--blue-bright)' }}>
                {days} days away
              </div>
            )}
            <div style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontFamily: 'JetBrains Mono', fontWeight: 600, textTransform: 'uppercase', background: color.dim, color: color.bg }}>
              {milestone.status}
            </div>
          </div>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {milestone.details.summary && <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{milestone.details.summary}</p>}
          {Object.entries(milestone.details).filter(([key]) => key !== 'summary').map(([key, value]) => (
            <div key={key} style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', padding: '16px' }}>
              <h3 style={{ fontSize: '11px', fontFamily: 'JetBrains Mono', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </h3>
              <div style={{ fontSize: '14px' }}>{renderValue(value)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

const LoadingSpinner = () => (
  <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: '48px', height: '48px', border: '4px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', margin: '0 auto 16px' }} className="animate-spin" />
      <p style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: '14px' }}>Loading timeline data...</p>
    </div>
  </div>
);

const ErrorBanner = ({ message }) => (
  <div style={{ maxWidth: '1280px', margin: '0 auto 24px', padding: '0 24px' }}>
    <div style={{ background: 'var(--yellow-dim)', border: '1px solid var(--yellow)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <span style={{ fontSize: '20px' }}>⚠️</span>
      <div>
        <p style={{ color: 'var(--yellow-bright)', fontWeight: 500 }}>Using fallback data</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>{message}</p>
      </div>
    </div>
  </div>
);

const MilestoneNode = ({ milestone, isSelected, onClick }) => {
  const color = getColor(milestone.type, milestone.isRisk, milestone.isCatalyst, milestone.isOutcome);
  const isFilled = milestone.status === 'current' || milestone.isRisk || milestone.isCatalyst || milestone.isOutcome;
  const isClickable = milestone.details;

  if (milestone.type === 'start') {
    return (
      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
        {milestone.title}
      </div>
    );
  }

  if (milestone.type === 'statutory') {
    return (
      <div style={{ width: '96px', height: '96px', transform: 'rotate(45deg)', borderRadius: '12px', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0', boxShadow: isSelected ? `0 0 20px ${color.bg}60` : 'none' }}>
        <div style={{ transform: 'rotate(-45deg)', textAlign: 'center', padding: '8px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', fontWeight: 700, lineHeight: 1.3 }}>{milestone.title}</div>
          <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '4px' }}>{milestone.subtitle}</div>
        </div>
      </div>
    );
  }

  if (milestone.type === 'conditional') {
    return (
      <div style={{ padding: '8px 16px', border: '2px dashed var(--border)', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', background: isSelected ? 'var(--bg-tertiary)' : 'transparent' }}>
        {milestone.title}
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', borderRadius: '12px', minWidth: '160px', maxWidth: '180px', background: isFilled ? color.bg : color.dim, border: `2px solid ${isFilled ? color.bg : 'var(--border)'}`, boxShadow: isSelected ? `0 0 24px ${color.bg}50` : 'none', transform: isSelected ? 'scale(1.02)' : 'none', transition: 'all 0.2s' }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', fontWeight: 700, marginBottom: '4px', color: isFilled ? 'white' : color.bg }}>{milestone.title}</div>
      {milestone.subtitle && <div style={{ fontSize: '12px', marginBottom: '4px', color: isFilled ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>{milestone.subtitle}</div>}
      <div style={{ fontSize: '11px', color: isFilled ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', fontStyle: milestone.isCatalyst ? 'normal' : 'italic', fontWeight: milestone.isCatalyst ? 600 : 400 }}>{milestone.description}</div>
      {milestone.isCatalyst && <div style={{ marginTop: '8px', padding: '4px 8px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', fontSize: '10px', fontFamily: 'JetBrains Mono', fontWeight: 600, display: 'inline-block' }}>💰 CATALYST #{milestone.catalystOrder}</div>}
      {isClickable && <div style={{ marginTop: '8px', fontSize: '11px', color: isFilled ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>Details →</div>}
    </div>
  );
};

const Timeline = ({ milestones, selected, onSelect }) => {
  return (
    <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content', padding: '24px 0' }}>
        {milestones.map((m, i) => {
          const days = getDaysUntil(m.date);
          const isLast = i === milestones.length - 1;
          const isClickable = m.details;
          const isSelected = selected?.id === m.id;

          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'stretch' }}>
              <div
                onClick={() => isClickable && onSelect(isSelected ? null : m)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: isClickable ? 'pointer' : 'default', transition: 'transform 0.2s', transform: isSelected ? 'translateY(-4px)' : 'none' }}
              >
                {/* Date */}
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', marginBottom: '8px', height: '20px', color: m.status === 'current' ? 'var(--blue-bright)' : 'var(--text-muted)', fontWeight: m.status === 'current' ? 600 : 400 }}>
                  {formatDate(m.date)}
                </div>

                {/* Node */}
                <MilestoneNode milestone={m} isSelected={isSelected} />

                {/* Status */}
                {m.type !== 'start' && m.type !== 'conditional' && (
                  <div style={{ marginTop: '8px', padding: '4px 12px', borderRadius: '4px', fontSize: '10px', fontFamily: 'JetBrains Mono', fontWeight: 600, background: m.status === 'current' ? 'var(--blue-dim)' : m.status === 'completed' ? 'var(--green-dim)' : 'var(--bg-tertiary)', color: m.status === 'current' ? 'var(--blue-bright)' : m.status === 'completed' ? 'var(--green-bright)' : 'var(--text-muted)' }}>
                    {m.status === 'current' ? 'CURRENT' : m.status === 'completed' ? 'DONE' : 'UPCOMING'}
                  </div>
                )}

                {/* Days until */}
                {days > 0 && m.status !== 'completed' && (
                  <div style={{ marginTop: '4px', fontSize: '11px', fontFamily: 'JetBrains Mono', color: days <= 7 ? 'var(--red)' : days <= 14 ? 'var(--yellow)' : 'var(--text-muted)' }}>
                    {days}d away
                  </div>
                )}
              </div>

              {/* Connector */}
              {!isLast && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', marginTop: '28px' }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: '40px', height: '2px', background: m.status === 'completed' ? 'var(--green)' : 'var(--border)' }} />
                    <div style={{ position: 'absolute', right: '-6px', top: '-4px', width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: `8px solid ${m.status === 'completed' ? 'var(--green)' : 'var(--border)'}` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// Main App Component
// =============================================================================

const App = () => {
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [milestonesRes, configRes] = await Promise.all([fetch(MILESTONES_URL), fetch(CONFIG_URL)]);
        const [milestonesText, configText] = await Promise.all([milestonesRes.text(), configRes.text()]);
        const milestonesRows = parseSheetData(milestonesText);
        const configRows = parseSheetData(configText);
        if (!milestonesRows) throw new Error('Failed to parse data');
        const config = {};
        configRows?.forEach(row => { config[row.key] = row.value; });
        setData({
          lastUpdated: config.lastUpdated || new Date().toISOString().split('T')[0],
          milestones: transformMilestones(milestonesRows)
        });
      } catch (err) {
        console.error(err);
        setData(fallbackData);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner />;

  const { milestones, lastUpdated } = data;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '24px' }}>
      {/* Header */}
      <div style={{ maxWidth: '1280px', margin: '0 auto 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--blue) 0%, var(--green) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: '14px' }}>TMC</div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Regulatory Pathway Timeline</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>The Metals Company • Commercial Recovery Permit</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)' }} className="animate-pulse" />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: 'var(--green-bright)', fontWeight: 600 }}>LIVE</span>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Timeline Card */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: '4px' }}>Regulatory Process Flow</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Click any milestone for details • Scroll to view full timeline</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--blue)' }} /><span style={{ color: 'var(--text-secondary)' }}>Procedural</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--red)' }} /><span style={{ color: 'var(--text-secondary)' }}>Risk</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', transform: 'rotate(45deg)', background: 'var(--yellow)' }} /><span style={{ color: 'var(--text-secondary)' }}>Statutory</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--green)' }} /><span style={{ color: 'var(--text-secondary)' }}>Catalyst</span></div>
          </div>
        </div>

        <Timeline milestones={milestones} selected={selected} onSelect={setSelected} />
      </div>

      {/* Footer */}
      <div style={{ maxWidth: '1280px', margin: '32px auto 0', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', flexWrap: 'wrap', gap: '8px' }}>
          <span>TMC Regulatory Pathway • For informational purposes only • Not financial advice</span>
          <span>Last updated: {formatDate(lastUpdated)}, 2026</span>
        </div>
      </div>

      {/* Detail Panel */}
      {selected && <DetailPanel milestone={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

// Mount the app
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
