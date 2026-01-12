
import React, { useEffect, useRef } from 'react';

interface VisualizerRingProps {
  analyser: AnalyserNode | null;
}

export const VisualizerRing: React.FC<VisualizerRingProps> = ({ analyser }) => {
  const ringRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!analyser || !ringRef.current) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const animate = () => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      let sum = 0;
      // Focus on lower-mid frequencies for voice
      const range = Math.floor(bufferLength / 2); 
      for (let i = 0; i < range; i++) {
        sum += dataArray[i];
      }
      const average = sum / range;
      
      // Normalize to 0-1 range roughly, but boost for visibility
      const scale = 1 + (average / 255) * 0.8; 
      const opacity = 0.3 + (average / 255) * 0.7;

      if (ringRef.current) {
        ringRef.current.style.transform = `scale(${scale})`;
        ringRef.current.style.opacity = `${opacity}`;
        ringRef.current.style.boxShadow = `0 0 ${20 + average / 2}px rgba(251, 191, 36, ${opacity})`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [analyser]);

  return (
    <div
      ref={ringRef}
      style={{
        position: 'absolute',
        inset: -10, // Extend slightly beyond the orb
        borderRadius: '50%',
        border: '2px solid rgba(251, 191, 36, 0.5)', // Gold color
        pointerEvents: 'none',
        zIndex: -1, // Behind the orb core
        transition: 'transform 0.05s linear, opacity 0.05s linear, box-shadow 0.05s linear',
        opacity: 0
      }}
    />
  );
};
