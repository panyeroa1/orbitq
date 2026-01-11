import React, { useEffect, useRef } from 'react';
import styles from '@/styles/OrbitMic.module.css';

interface OrbitMicVisualizerProps {
  analyser: AnalyserNode | null;
  isRecording: boolean;
}

export function OrbitMicVisualizer({ analyser, isRecording }: OrbitMicVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isRecording || !analyser || !canvasRef.current) {
      if (canvasRef.current) {
         const ctx = canvasRef.current.getContext('2d');
         ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Updated for specific user request: 15px base, 50px peak
    canvas.width = 120; 
    canvas.height = 50; 

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    let animationFrameId: number;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bars = 20;
      const barWidth = 4;
      const gap = 2;
      // Center the visualizer
      const totalWidth = bars * (barWidth + gap);
      const startX = (w - totalWidth) / 2;
      const centerY = h / 2;

      for (let i = 0; i < bars; i++) {
        // Map bar index to frequency data (simpler linear mapping or step)
        // Taking a subset of frequency bin prevents flat lines at high freq
        const fIndex = Math.floor(i * (dataArray.length / 3) / bars); 
        const v = dataArray[fIndex] / 255;
        // User request: 15px base, 50px max
        const bHeight = 15 + (v * 35); 

        const x = startX + i * (barWidth + gap);
        // Draw centered vertically
        const y = centerY - bHeight / 2;

        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + v * 0.5})`; // White bars with opacity mod
        // OR maintain the blue if preferred, but user just said "horizontal" and previous Context was white text.
        // Let's stick to the blue-ish from before but maybe lighter? 
        // User said "white text", but for visualizer "make the visualizer in horizontal". 
        // I'll stick to a nice cyan/white mix which looks "Orbit"-y.
        ctx.fillStyle = `rgba(56, 189, 248, ${0.6 + v * 0.4})`;

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, bHeight, 2);
        ctx.fill();
      }
    };

    draw();

    return () => cancelAnimationFrame(animationFrameId);
  }, [analyser, isRecording]);

  return <canvas ref={canvasRef} className={styles.orbitMicVisualizer} style={{ width: '120px', height: '100%' }} />;
}
