import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * ClaudePresenceIcon — A living, breathing representation of Claude's intelligence
 * flowing through your CRM. Like Siri's orb, but with neural network aesthetics.
 * 
 * Features:
 * - Animated neural network core
 * - Pulsing energy rings
 * - Floating particles (knowledge nodes)
 * - Responsive to activity (can speed up during sync)
 */
export default function ClaudePresenceIcon({ 
  size = 80, 
  active = false, 
  thinking = false,
  className = '' 
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const centerX = size / 2;
    const centerY = size / 2;
    const coreRadius = size * 0.15;

    // Initialize particles
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 20; i++) {
        particlesRef.current.push({
          angle: (Math.PI * 2 * i) / 20,
          radius: size * (0.35 + Math.random() * 0.25),
          speed: 0.02 + Math.random() * 0.03,
          size: 1.5 + Math.random() * 2,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, size, size);
      timeRef.current += active || thinking ? 0.03 : 0.015;

      // Draw outer energy rings
      for (let i = 0; i < 3; i++) {
        const ringRadius = size * (0.4 + i * 0.08);
        const opacity = 0.15 - i * 0.04;
        const phase = timeRef.current * (0.5 + i * 0.3);
        
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, ringRadius, ringRadius * 0.9, phase, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 158, 11, ${opacity * (0.5 + Math.sin(phase) * 0.5)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw neural network connections
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(timeRef.current * 0.2);
      
      particlesRef.current.forEach((particle, idx) => {
        particle.angle += particle.speed * (thinking ? 3 : active ? 2 : 1);
        particle.pulse += 0.05;

        const x = Math.cos(particle.angle) * particle.radius;
        const y = Math.sin(particle.angle) * particle.radius * 0.9;
        const pulseSize = particle.size * (1 + Math.sin(particle.pulse) * 0.3);

        // Draw connection lines to nearby particles
        particlesRef.current.forEach((other, otherIdx) => {
          if (idx !== otherIdx) {
            const dx = Math.cos(other.angle) * other.radius - x;
            const dy = Math.sin(other.angle) * other.radius * 0.9 - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < size * 0.3) {
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(Math.cos(other.angle) * other.radius, Math.sin(other.angle) * other.radius * 0.9);
              ctx.strokeStyle = `rgba(245, 158, 11, ${0.15 * (1 - dist / (size * 0.3))})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        });

        // Draw particle
        ctx.beginPath();
        ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 158, 11, ${0.6 + Math.sin(particle.pulse) * 0.4})`;
        ctx.fill();
      });
      
      ctx.restore();

      // Draw core intelligence orb
      const corePulse = Math.sin(timeRef.current * 2) * 0.2 + 1;
      const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, coreRadius * corePulse
      );
      gradient.addColorStop(0, 'rgba(245, 158, 11, 0.9)');
      gradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.4)');
      gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * corePulse, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Inner bright core
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 0.4 * corePulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + Math.sin(timeRef.current * 3) * 0.2})`;
      ctx.fill();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [size, active, thinking]);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        width={size * 2}
        height={size * 2}
        className="w-full h-full"
        style={{ transform: 'scale(0.5)' }}
      />
      
      {/* Glow effect overlay */}
      <div 
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.3) 0%, transparent 70%)',
          filter: 'blur(8px)',
          animation: thinking ? 'pulse 1s ease-in-out infinite' : active ? 'pulse 2s ease-in-out infinite' : 'none',
        }}
      />
    </div>
  );
}