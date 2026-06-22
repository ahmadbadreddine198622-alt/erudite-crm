import React from 'react';

const css = (str) => {
  const o = {};
  String(str).split(";").forEach((decl) => {
    const i = decl.indexOf(":");
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[camel] = v;
  });
  return o;
};

const QualificationItem = ({ label, value, color }) => (
  <div style={css("display:flex; flex-direction:column; align-items:center; text-align:center;")}>
    <span style={css("font-size:10px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>{label}</span>
    <span style={{...css("font-size:12.5px; font-weight:600; margin-top:4px;"), color: color || 'rgba(255,255,255,0.85)'}}>{value}</span>
  </div>
);

export default function QualificationStrip({ qualification }) {
  if (!qualification) return null;

  const items = [];

  if (qualification.archetype) {
    items.push(<QualificationItem key="archetype" label="Archetype" value={qualification.archetype} color="#c4b5fd" />);
  }
  if (qualification.rapport) {
    const rapportColor = {
      cold: 'rgba(255,255,255,0.6)',
      warming: 'hsl(38 92% 60%)',
      strong: '#34d399',
    }[qualification.rapport.toLowerCase()] || 'rgba(255,255,255,0.85)';
    items.push(<QualificationItem key="rapport" label="Rapport" value={qualification.rapport} color={rapportColor} />);
  }
  if (qualification.competition) {
    items.push(<QualificationItem key="competition" label="Competition" value={qualification.competition} />);
  }
  if (qualification.priorBrokerage) {
    items.push(<QualificationItem key="priorBrokerage" label="Prior Brokers" value={qualification.priorBrokerage} />);
  }

  if (items.length === 0) return null;

  return (
    <div style={css("margin-top:16px; border-radius:13px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.025); padding:10px 15px; display:flex; align-items:center; justify-content:space-around; gap:16px; animation: ld-rise 0.48s cubic-bezier(0.22,1,0.36,1) both;")}>
      {items}
    </div>
  );
}