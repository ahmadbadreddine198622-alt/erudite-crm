import { useState, useEffect } from 'react';

export default function ClockWidget() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time for Dubai timezone
  const dubaiTime = time.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Dubai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const [timePart, secondsPart] = dubaiTime.split(':');
  const [hours, minutes] = timePart.split(':');

  // Format date
  const dubaiDate = time.toLocaleDateString('en-US', {
    timeZone: 'Asia/Dubai',
    weekday: 'short',
    month: 'short',
    day: '2-digit',
  });

  return (
    <div
      style={{
        width: 42,
        minHeight: 64,
        borderRadius: 14,
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderTopColor: 'rgba(255,255,255,0.1)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 4px',
        cursor: 'default',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
      }}
    >
      {/* Time display */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 200,
            color: 'rgba(255,255,255,0.92)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}
        >
          {hours}:{minutes}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 300,
            color: 'rgba(201,162,75,0.7)',
            fontVariantNumeric: 'tabular-nums',
            opacity: 0.8,
          }}
        >
          :{secondsPart}
        </span>
      </div>

      {/* Date display */}
      <div
        style={{
          marginTop: 2,
          fontSize: 7,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
        }}
      >
        {dubaiDate.replace(',', '')}
      </div>
    </div>
  );
}