import PageHeader from '@/components/shared/PageHeader';

export default function Negotiations() {
    return (
        <div className="p-6 max-w-[1800px] mx-auto min-h-screen"
            style={{
                background: 'radial-gradient(ellipse at 30% 10%, rgba(20,30,60,0.55) 0%, rgba(8,11,18,0.92) 45%, rgba(6,8,14,0.98) 100%)',
            }}
        >
            <PageHeader 
                title="Negotiations" 
                subtitle="Offer and counteroffer orchestration engine"
            />
            <div className="mt-8 text-center text-white/40">
                <p>Negotiations module coming soon</p>
            </div>
        </div>
    );
}