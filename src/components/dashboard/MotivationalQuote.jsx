import { useState, useEffect } from 'react';

const QUOTES = [
  "Discipline is the bridge between goals and accomplishment.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "The only way to do great work is to love what you do.",
  "Believe you can and you're halfway there.",
  "Your limitation—it's only your imagination.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it.",
  "Success doesn't just find you. You have to go out and get it.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Dream bigger. Do bigger.",
  "Don't stop when you're tired. Stop when you're done.",
  "Wake up with determination. Go to bed with satisfaction.",
  "Do something today that your future self will thank you for.",
  "Little things make big days.",
  "It's going to be hard, but hard does not mean impossible.",
  "Don't wait for opportunity. Create it.",
  "Sometimes we're tested not to show our weaknesses, but to discover our strengths.",
  "The key to success is to start before you're ready.",
  "Your future is created by what you do today, not tomorrow.",
  "Through perseverance many people win success out of seeming failure.",
  "Success is the sum of small efforts repeated day in and day out.",
  "Opportunities don't happen. You create them.",
  "Don't be pushed around by the fears in your mind. Be led by the dreams in your heart.",
  "Work hard in silence, let your success be your noise.",
  "Do what you have to do until you can do what you want to do.",
  "The difference between ordinary and extraordinary is that little extra.",
  "You don't have to be great to start, but you have to start to be great.",
  "A journey of a thousand miles begins with a single step.",
  "Fall seven times, stand up eight.",
];

export default function MotivationalQuote() {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [fadeState, setFadeState] = useState('visible');

  useEffect(() => {
    const interval = setInterval(() => {
      setFadeState('fading');
      setTimeout(() => {
        setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
        setFadeState('hidden');
        setTimeout(() => setFadeState('visible'), 50);
      }, 300);
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, []);

  const transitionStyle = {
    opacity: fadeState === 'visible' ? 1 : 0,
    transition: 'opacity 0.3s ease',
  };

  return (
    <div
      className="w-full max-w-md mx-auto mb-6 px-4"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 24,
        padding: '20px 24px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Gradient bar at top */}
      <div
        className="w-full h-1 rounded-full mb-4"
        style={{
          background: 'linear-gradient(90deg, #6B7280 0%, #D4AF37 100%)',
          boxShadow: '0 2px 8px rgba(212,175,55,0.2)',
        }}
      />

      {/* Quote text */}
      <p
        className="text-center text-sm font-medium"
        style={{
          color: 'rgba(255,255,255,0.75)',
          lineHeight: 1.6,
          letterSpacing: '0.01em',
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...transitionStyle,
        }}
      >
        {QUOTES[quoteIndex]}
      </p>
    </div>
  );
}