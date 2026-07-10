import { BookOpen, Flame, Dumbbell, Compass, Users, Sparkles } from 'lucide-react';

export const CHAMBERS = [
  { to: '/academy/hall', name: 'THE HALL', short: 'Hall', motto: 'where we learn it', icon: BookOpen, desc: 'Principle library, full lessons, and reading assignments' },
  { to: '/academy/mirror', name: 'THE MIRROR', short: 'Mirror', motto: 'where we become it', icon: Flame, desc: 'Chief Aim, affirmation forge, and morning ritual' },
  { to: '/academy/dojo', name: 'THE DOJO', short: 'Dojo', motto: 'where we rehearse it', icon: Dumbbell, desc: 'Daily drills, knowledge checks, and sparring' },
  { to: '/academy/field', name: 'THE FIELD', short: 'Field', motto: 'where we live it', icon: Compass, desc: "Apply this week's principle to your live pipeline" },
  { to: '/academy/council', name: 'THE COUNCIL', short: 'Council', motto: 'where we prove it', icon: Users, desc: 'Reflections, mastermind, leaderboard, and scores' },
  { to: '/academy/mentor', name: 'THE MENTOR', short: 'Mentor', motto: 'where we are guided', icon: Sparkles, desc: 'Converse with the living voice of the 17 principles' },
];