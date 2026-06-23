import React from 'react';
import { DollarSign, Phone } from 'lucide-react';
import ListingManagerStrip from '@/components/landlord/ListingManagerStrip';
import CallQualificationTab from '@/components/landlord/CallQualificationTab';
import CollapsibleSection from '@/components/landlord/CollapsibleSection';
import PhoneNumbersPanel from '@/components/landlord/PhoneNumbersPanel';
import MediaPanel from '@/components/landlord/MediaPanel';
import MandatePanel from '@/components/landlord/MandatePanel';
import Scorecards from '@/components/landlord/Scorecards';
import RiskSignals from '@/components/landlord/RiskSignals';
import ContactEvaluation from '@/components/landlord/ContactEvaluation';
import DocumentsTab from '@/components/landlord/DocumentsTab';

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

const LandlordDetailPanels = ({ L, vm, openSections, toggleSection, onNavigate, ...props }) => {
  if (!L) return null;

  return (
    <div className="ld-panel ld-scroll" style={css("flex:1 1 38%; min-width:0; height:100%; min-height:0; overflow-y:auto; padding:18px 22px 28px;")}>
        <ListingManagerStrip 
            listingManagerEmail={L.listing_manager_email}
            assignedAgentEmail={L.assigned_agent_email}
            phone={L.phone}
            whatsapp={L.whatsapp}
        />
        <CallQualificationTab landlord={L} />

        <CollapsibleSection
            icon={DollarSign}
            title="Commission Pipeline"
            isOpen={openSections.commission}
            onToggle={() => toggleSection('commission')}
            count={vm.mandate ? 1 : 0}
        >
            {vm.mandate ? (
                <div style={css("flex:1; min-width:0;")}>
                    <div style={css("font-size:13px; font-weight:700; color:#E69D43; margin-top:2px;")}>
                        {vm.mandate.commission} · {vm.mandate.askingPrice}
                    </div>
                </div>
            ) : (
                <div style={css("font-size:11px; font-weight:600; color:rgba(255,255,255,0.4); margin-top:2px;")}>
                No commission yet
                </div>
            )}
        </CollapsibleSection>

        <CollapsibleSection
            icon={Phone} 
            title="Call History"
            isOpen={openSections.callHistory}
            onToggle={() => toggleSection('callHistory')}
            count={vm.calls.length}
        >
            {vm.calls.length > 0 ? (
                <div style={css("display:flex; flex-direction:column; gap:8px;")}>
                {vm.calls.map((cl)=>(
                    <div key={cl.key} style={css("display:flex; align-items:center; gap:12px; padding:11px 13px; border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07);")}>
                    <span style={cl.iconStyle}>{cl.icon}</span>
                    <div style={css("flex:1; min-width:0;")}>
                        <div style={css("font-size:13px; font-weight:600; color:rgba(255,255,255,0.88);")}>{cl.title}</div>
                        <div style={css("display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:4px;")}>
                        <span style={cl.provStyle}>{cl.provIcon} {cl.provLabel}</span>
                        <span style={cl.statusStyle}>{cl.statusLabel}</span>
                        {cl.recording && (<span style={cl.recStyle}>▶ Recording</span>)}
                        <span style={css("font-size:11px; color:rgba(255,255,255,0.42);")}>{cl.meta}</span>
                        </div>
                    </div>
                    <span style={css("font-size:12px; font-weight:600; color:rgba(255,255,255,0.6);")}>{cl.dur}</span>
                    </div>
                ))}
                </div>
            ) : (
                <div style={css("font-size:11px; font-weight:600; color:rgba(255,255,255,0.4); margin-top:2px;")}>No calls logged yet</div>
            )}
      </CollapsibleSection>


        <PhoneNumbersPanel landlord={L} />

        {L.email && (
            <div style={css("margin-top:8px; border-radius:13px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.025); padding:11px 15px;")}>
            <div style={css("font-size:10.5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Email</div>
            <a href={`mailto:${L.email}`} style={css("font-size:13.5px; font-weight:600; margin-top:5px; color:rgba(255,255,255,0.9); overflow:hidden; text-overflow:ellipsis; display:block; text-decoration:none;")}>{L.email}</a>
            </div>
        )}

        <MediaPanel {...props} />

        {vm.mandate && <MandatePanel mandate={vm.mandate} />}

        {vm.showSignals && <Scorecards scorecards={vm.scorecards} />}
        <RiskSignals signals={vm.signals} flagChips={vm.flagChips} buyChips={vm.buyChips} hasFlags={vm.hasFlags} />

        <div style={css("margin-top:16px; border-radius:15px; border:1px solid rgba(255,255,255,0.09); background:rgba(255,255,255,0.025); padding:16px 17px;")}>
            <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:10px;")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="hsl(38 92% 60%)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
            <span style={css("font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.6);")}>AI Summary</span>
            </div>
            <p style={css("margin:0; font-size:13.5px; line-height:1.6; color:rgba(255,255,255,0.8);")}>{vm.summaryText}</p>
        </div>

        <ContactEvaluation valuation={vm.valuation} comps={vm.market?.comps} />

        <div style={css("margin-top:18px;")}>
            <div style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;")}>
            <span style={css("font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.6);")}>Documents & Mandate</span>
            </div>
            <DocumentsTab docs={vm.docs} />
        </div>
    </div>
  );
};

export default LandlordDetailPanels;