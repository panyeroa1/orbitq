'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDeepgramTranscription } from './useDeepgramTranscription';
import { useGeminiLive } from './useGeminiLive';
import { useWebSpeech } from './useWebSpeech';
import { useAssemblyAI } from './useAssemblyAI';

// Styles specific to this overlay
const overlayStyles = {
  controlPill: {
    backgroundColor: '#2e7d32', // Forest Green
    borderRadius: '50px',
    display: 'flex',
    alignItems: 'center',
    padding: '5px 8px',
    boxShadow: '0 4px 15px rgba(0, 255, 0, 0.3)',
    position: 'absolute' as 'absolute',
    userSelect: 'none' as 'none',
    border: '1px solid #4caf50',
    cursor: 'grab',
    zIndex: 1000,
    transition: 'box-shadow 0.2s',
  },
  pillSection: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 15px',
    cursor: 'pointer',
    borderRadius: '30px',
    gap: '8px',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '13px',
  },
  divider: {
    width: '1px',
    height: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    margin: '0 2px',
  },
  captionBar: {
    position: 'fixed' as 'fixed',
    bottom: 0,
    left: 0,
    width: '100%',
    height: '80px',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderTop: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 40px',
    zIndex: 999,
  },
  transcriptText: {
    fontSize: '24px',
    color: '#ffffff',
    fontWeight: 500,
    textAlign: 'center' as 'center',
    whiteSpace: 'nowrap' as 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    width: '100%',
    textShadow: '0px 2px 4px rgba(0,0,0,0.8)',
  },
  interim: {
    color: '#aaa',
    fontStyle: 'italic' as 'italic',
  }
};

type ModelCode = 'ORBT' | 'SONQ' | 'DELX' | 'PLTO';

const MODEL_MAP: Record<ModelCode, { name: string; provider: string }> = {
  'ORBT': { name: 'Deepgram', provider: 'deepgram' },
  'SONQ': { name: 'AssemblyAI', provider: 'assemblyai' },
  'DELX': { name: 'Gemini Live', provider: 'gemini' },
  'PLTO': { name: 'WebSpeech', provider: 'webspeech' }
};

interface CinemaCaptionOverlayProps {
    onTranscriptSegment: (segment: { text: string; language: string; isFinal: boolean }) => void;
    defaultDeviceId?: string;
}

export function CinemaCaptionOverlay({ onTranscriptSegment, defaultDeviceId }: CinemaCaptionOverlayProps) {
    const [position, setPosition] = useState({ x: 50, y: 50 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const [selectedModel, setSelectedModel] = useState<ModelCode>('ORBT');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    // All transcription hooks
    const deepgram = useDeepgramTranscription({
        model: 'nova-2',
        language: 'en',
        onTranscript: (res) => {
            if (res.isFinal) {
                onTranscriptSegment({ text: res.transcript, language: 'en', isFinal: true });
            }
        }
    });

    const gemini = useGeminiLive();
    const webspeech = useWebSpeech();
    const assembly = useAssemblyAI();

    // Map to active hook based on selected model
    let activeHook: any;
    switch (selectedModel) {
        case 'ORBT':
            activeHook = deepgram;
            break;
        case 'SONQ':
            activeHook = assembly;
            break;
        case 'DELX':
            activeHook = {
                isListening: gemini.isRecording,
                transcript: gemini.transcription,
                interimTranscript: '',
                startListening: gemini.toggleRecording,
                stopListening: gemini.toggleRecording
            };
            break;
        case 'PLTO':
            activeHook = webspeech;
            break;
    }

    const { isListening, transcript, interimTranscript, startListening, stopListening } = activeHook;

    // Draggable Logic
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.dropdown-trigger') || (e.target as HTMLElement).closest('.dropdown-menu')) return;
        
        setIsDragging(true);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffset.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y
            });
        }
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const toggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening(defaultDeviceId);
        }
    };

    const handleModelChange = (model: ModelCode) => {
        // Stop current provider
        if (isListening) {
            stopListening();
        }
        setSelectedModel(model);
        setIsMenuOpen(false);
    };

    return (
        <>
            {/* Draggable Pill */}
            <div 
                style={{
                    ...overlayStyles.controlPill,
                    left: position.x,
                    top: position.y,
                    cursor: isDragging ? 'grabbing' : 'grab',
                }}
                onMouseDown={handleMouseDown}
            >
                {/* SPEAK Button */}
                <div 
                    style={{...overlayStyles.pillSection, backgroundColor: isListening ? '#d32f2f' : 'transparent'}}
                    onClick={toggleListening}
                >
                    <span>{isListening ? 'STOP' : 'SPEAK'}</span>
                </div>

                <div style={overlayStyles.divider} />

                {/* Model Selector Dropdown */}
                <div 
                    className="dropdown-trigger"
                    style={overlayStyles.pillSection}
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                    <span>{selectedModel}</span>
                    <span>▼</span>
                </div>

                {isMenuOpen && (
                    <div className="dropdown-menu" style={{
                        position: 'absolute',
                        top: '115%',
                        left: 0,
                        backgroundColor: '#1e1e1e',
                        borderRadius: '12px',
                        border: '1px solid #444',
                        padding: '5px',
                        minWidth: '180px',
                        color: 'white'
                    }}>
                        {(Object.keys(MODEL_MAP) as ModelCode[]).map(code => (
                            <div 
                                key={code}
                                style={{
                                    padding: '10px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    borderBottom: code !== 'PLTO' ? '1px solid #333' : 'none',
                                    backgroundColor: selectedModel === code ? 'rgba(76, 175, 80, 0.2)' : 'transparent',
                                    fontWeight: selectedModel === code ? 700 : 400
                                }}
                                onClick={() => handleModelChange(code)}
                            >
                                <span style={{fontWeight: 700}}>{code}</span> - {MODEL_MAP[code].name}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Caption Bar */}
            <div style={overlayStyles.captionBar}>
                <div style={overlayStyles.transcriptText}>
                    {transcript} <span style={overlayStyles.interim}>{interimTranscript}</span>
                    {!transcript && !interimTranscript && isListening && (
                        <span style={{color: '#666', fontSize: '18px'}}>Listening...</span>
                    )}
                </div>
            </div>
        </>
    );
}
