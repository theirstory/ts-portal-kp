'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Box, Button, IconButton, InputAdornment, Menu, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import MicIcon from '@mui/icons-material/Mic';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import LanguageIcon from '@mui/icons-material/Language';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { ChatMessage } from './ChatMessage';
import { TextSelectionPopover } from './TextSelectionPopover';
import { colors } from '@/lib/theme';

const SPEECH_LANGUAGES = [
  { code: 'en-US', label: 'English' },
  { code: 'es-ES', label: 'Espa\u00f1ol' },
  { code: 'fr-FR', label: 'Fran\u00e7ais' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'pt-BR', label: 'Portugu\u00eas' },
  { code: 'it-IT', label: 'Italiano' },
  { code: 'nl-NL', label: 'Nederlands' },
  { code: 'ru-RU', label: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439' },
  { code: 'zh-CN', label: '\u4e2d\u6587' },
  { code: 'ja-JP', label: '\u65e5\u672c\u8a9e' },
  { code: 'ko-KR', label: '\ud55c\uad6d\uc5b4' },
  { code: 'ar-SA', label: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' },
  { code: 'hi-IN', label: '\u0939\u093f\u0928\u094d\u0926\u0940' },
  { code: 'vi-VN', label: 'Ti\u1ebfng Vi\u1ec7t' },
  { code: 'th-TH', label: '\u0e44\u0e17\u0e22' },
  { code: 'pl-PL', label: 'Polski' },
  { code: 'tr-TR', label: 'T\u00fcrk\u00e7e' },
  { code: 'uk-UA', label: '\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430' },
  { code: 'id-ID', label: 'Bahasa Indonesia' },
  { code: 'ms-MY', label: 'Bahasa Melayu' },
];

export const STARTER_QUESTIONS = [
  'What are interesting questions this collection could uniquely answer?',
  'What are common themes across the collection?',
];

type QAPair = { userMsg: ChatMessageType; assistantMsg: ChatMessageType };

type ChatMessagesThreadProps = {
  messages: ChatMessageType[];
  isStreaming: boolean;
  streamingStatus: string | null;
  messagesContainerRef: MutableRefObject<HTMLDivElement | null>;
  messagesEndRef: MutableRefObject<HTMLDivElement | null>;
  onViewSources: (messageId: string) => void;
  variant?: 'default' | 'compact';
};

type ChatComposerProps = {
  input: string;
  isStreaming: boolean;
  inputRef?: MutableRefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onStop?: () => void;
  placeholder: string;
  variant?: 'default' | 'compact';
  fullHeight?: boolean;
};

type ChatStarterQuestionsProps = {
  onStarterClick: (question: string) => void;
  variant?: 'default' | 'compact';
  headingOnly?: boolean;
  promptsOnly?: boolean;
};

function buildQAPairs(messages: ChatMessageType[]): QAPair[] {
  const result: QAPair[] = [];
  for (let i = 0; i < messages.length; i += 2) {
    if (messages[i]?.role === 'user' && messages[i + 1]?.role === 'assistant') {
      result.push({ userMsg: messages[i], assistantMsg: messages[i + 1] });
    }
  }
  return result;
}

export function ChatStarterQuestions({ onStarterClick, variant = 'default', headingOnly = false, promptsOnly = false }: ChatStarterQuestionsProps) {
  const compact = variant === 'compact';

  return (
    <Box
      id={compact ? 'chat-starter-questions-compact' : 'chat-starter-questions'}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: (headingOnly || promptsOnly) ? 'auto' : '100%',
        px: compact ? 2 : (headingOnly || promptsOnly) ? 0 : { xs: 2, md: 3 },
        py: compact ? 4 : 0,
      }}>
      <Box
        id={compact ? 'chat-starter-questions-list-compact' : 'chat-starter-questions-list'}
        sx={{
          width: '100%',
          maxWidth: compact ? '100%' : (headingOnly || promptsOnly) ? '100%' : 680,
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? 1 : 1,
        }}>
        {!promptsOnly && (
          <Typography
            variant={compact ? 'body1' : 'h4'}
            fontWeight={600}
            color={colors.text.primary}
            sx={{ textAlign: 'center', mb: compact ? 2 : 0.5 }}>
            Ask about the interviews
          </Typography>
        )}

        {!headingOnly && STARTER_QUESTIONS.map((q) => (
          <Button
            id={`chat-starter-question-${q
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '')}`}
            key={q}
            variant="outlined"
            fullWidth
            onClick={() => onStarterClick(q)}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              borderColor: colors.grey[300],
              color: colors.text.primary,
              fontSize: compact ? '0.8rem' : '0.875rem',
              py: compact ? 1.25 : 1.5,
              px: compact ? 2 : 3,
              justifyContent: 'flex-start',
              textAlign: 'left',
              bgcolor: colors.background.paper,
              boxShadow: compact ? 'none' : `0 1px 3px ${colors.common.shadow}`,
              '&:hover': {
                borderColor: colors.primary.main,
                bgcolor: compact ? colors.background.subtle : colors.background.paper,
                boxShadow: compact ? 'none' : `0 2px 6px ${colors.common.shadow}`,
              },
            }}>
            {q}
          </Button>
        ))}
      </Box>
    </Box>
  );
}

export function ChatMessagesThread({
  messages,
  isStreaming,
  streamingStatus,
  messagesContainerRef,
  messagesEndRef,
  onViewSources,
  variant = 'default',
}: ChatMessagesThreadProps) {
  const compact = variant === 'compact';
  const pairRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pairs = useMemo(() => buildQAPairs(messages), [messages]);

  const navigateToPair = (pairIndex: number) => {
    const pair = pairs[pairIndex];
    if (!pair) return;
    const el = pairRefs.current.get(pair.userMsg.id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <Box
      id={compact ? 'chat-messages-thread-compact' : 'chat-messages-thread'}
      ref={messagesContainerRef}
      sx={{
        flex: 1,
        overflow: 'auto',
        minHeight: 0,
        position: 'relative',
        pb: compact ? 0 : 2,
        marginTop: 2,
        scrollbarWidth: 'auto',
        scrollbarColor: `${colors.primary.light} transparent`,
        '&::-webkit-scrollbar': {
          width: 12,
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'transparent',
          borderRadius: 999,
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: colors.primary.light,
          borderRadius: 999,
          border: '2px solid transparent',
          backgroundClip: 'padding-box',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          backgroundColor: colors.primary.main,
        },
      }}>
      <TextSelectionPopover containerRef={messagesContainerRef} />
      <Box
        id={compact ? 'chat-messages-list-compact' : 'chat-messages-list'}
        sx={{
          px: compact ? 2 : 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
        {pairs.map((pair, pairIndex) => (
          <Box
            id={`chat-message-pair-${pair.userMsg.id}`}
            key={pair.userMsg.id}
            ref={(el: HTMLDivElement | null) => {
              if (el) pairRefs.current.set(pair.userMsg.id, el);
              else pairRefs.current.delete(pair.userMsg.id);
            }}>
            <Box
              id={`chat-message-sticky-${pair.userMsg.id}`}
              sx={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                pb: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                width: '100%',
                background: `linear-gradient(180deg, ${colors.background.storyPage} 0%, ${colors.background.storyPage} 78%, rgba(224, 224, 224, 0) 100%)`,
              }}>
              <Box
                sx={{
                  overflow: 'hidden',
                  borderRadius: 1,
                  px: compact ? 1 : 1.25,
                  py: compact ? 0.9 : 1,
                  color: colors.common.white,
                  background: `linear-gradient(135deg, ${colors.primary.dark} 0%, ${colors.primary.main} 100%)`,
                  boxShadow: `0 6px 18px ${colors.common.shadow}`,
                }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  {pairs.length > 1 && (
                    <Box
                      id={`chat-pair-navigation-${pair.userMsg.id}`}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        flexShrink: 0,
                        gap: 0.25,
                        px: 0.25,
                      }}>
                      <IconButton
                        size="small"
                        disabled={pairIndex === 0}
                        onClick={() => navigateToPair(pairIndex - 1)}
                        sx={{
                          p: 0.25,
                          color: 'rgba(255,255,255,0.88)',
                          bgcolor: 'rgba(255,255,255,0.08)',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
                          '&.Mui-disabled': { color: 'rgba(255,255,255,0.28)' },
                        }}>
                        <KeyboardArrowUpIcon sx={{ fontSize: compact ? 18 : 20 }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        disabled={pairIndex === pairs.length - 1}
                        onClick={() => navigateToPair(pairIndex + 1)}
                        sx={{
                          p: 0.25,
                          color: 'rgba(255,255,255,0.88)',
                          bgcolor: 'rgba(255,255,255,0.08)',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
                          '&.Mui-disabled': { color: 'rgba(255,255,255,0.28)' },
                        }}>
                        <KeyboardArrowDownIcon sx={{ fontSize: compact ? 18 : 20 }} />
                      </IconButton>
                    </Box>
                  )}
                  <Box
                    sx={{
                      minWidth: 0,
                      flex: 1,
                      px: compact ? 0.75 : 0.5,
                      py: compact ? 0.2 : 0.25,
                      fontSize: compact ? '0.8rem' : '0.875rem',
                      lineHeight: 1.5,
                      fontWeight: 500,
                    }}>
                    {pair.userMsg.content}
                  </Box>
                  {pair.assistantMsg.citations && pair.assistantMsg.citations.length > 0 && (
                    <Button
                      id={`chat-view-sources-${pair.assistantMsg.id}`}
                      size="small"
                      startIcon={<FormatListBulletedIcon sx={{ fontSize: 14 }} />}
                      onClick={() => onViewSources(pair.assistantMsg.id)}
                      sx={{
                        flexShrink: 0,
                        textTransform: 'none',
                        fontSize: compact ? '0.72rem' : '0.76rem',
                        color: colors.primary.contrastText,
                        px: 1.25,
                        py: 0.55,
                        minHeight: 0,
                        borderRadius: 999,
                        bgcolor: 'rgba(255,255,255,0.14)',
                        border: '1px solid rgba(255,255,255,0.16)',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.22)',
                        },
                      }}>
                      {pair.assistantMsg.citations.length} sources
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
            <Box sx={{ pt: compact ? 1 : 1.5 }} data-assistant-message-id={pair.assistantMsg.id}>
              {isStreaming && !pair.assistantMsg.content && streamingStatus ? (
                <Box
                  id={`chat-streaming-status-${pair.assistantMsg.id}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: compact ? 1 : 1.5,
                    px: compact ? 1.5 : 2,
                    py: compact ? 1 : 1.5,
                  }}>
                  <Box
                    sx={{
                      width: compact ? 16 : 20,
                      height: compact ? 16 : 20,
                      borderRadius: '50%',
                      border: `2px solid ${colors.primary.main}`,
                      borderTopColor: 'transparent',
                      animation: 'spin 0.8s linear infinite',
                      flexShrink: 0,
                      '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
                    }}
                  />
                  <Typography
                    variant="body2"
                    color={colors.text.secondary}
                    sx={{ fontSize: compact ? '0.8rem' : '0.85rem' }}>
                    {streamingStatus}
                  </Typography>
                </Box>
              ) : (
                <Box id={`chat-assistant-response-${pair.assistantMsg.id}`}>
                  <ChatMessage message={pair.assistantMsg} />
                </Box>
              )}
            </Box>
          </Box>
        ))}
        <div id="chat-messages-end" ref={messagesEndRef} />
      </Box>
    </Box>
  );
}

function AudioWaveform({ stream }: { stream: MediaStream | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyserRef.current = analyser;
    contextRef.current = audioCtx;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const barCount = 48;

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const centerX = w / 2;
      const centerY = h / 2;
      const barWidth = 2.5;
      const gap = (w - barCount * barWidth) / (barCount - 1);
      const step = Math.floor(dataArray.length / barCount);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] / 255;
        const minH = 2;
        const maxH = h * 0.85;
        // Bars taper from center outward
        const distFromCenter = Math.abs(i - barCount / 2) / (barCount / 2);
        const taper = 1 - distFromCenter * 0.5;
        const barH = Math.max(minH, value * maxH * taper);
        const x = i * (barWidth + gap);
        const y = centerY - barH / 2;

        ctx.fillStyle = value > 0.05 ? 'rgba(100,100,100,0.8)' : 'rgba(180,180,180,0.5)';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, barWidth / 2);
        ctx.fill();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      source.disconnect();
      audioCtx.close();
    };
  }, [stream]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

export function ChatComposer({
  input,
  isStreaming,
  inputRef,
  onInputChange,
  onSubmit,
  onKeyDown,
  onStop,
  placeholder,
  variant = 'default',
  fullHeight = false,
}: ChatComposerProps) {
  const compact = variant === 'compact';
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechLang, setSpeechLang] = useState('');
  const [langMenuAnchor, setLangMenuAnchor] = useState<null | HTMLElement>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [preListenInput, setPreListenInput] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    setSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
    setSpeechLang(navigator.language || 'en-US');
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      setMediaStream(null);
    }
    setIsListening(false);
  }, [mediaStream]);

  const startListening = useCallback(async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return;
    }
    setMediaStream(stream);
    setPreListenInput(input);
    transcriptRef.current = '';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLang;

    const baseInput = input;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      transcriptRef.current = finalTranscript + interim;
      onInputChange(baseInput + (baseInput ? ' ' : '') + finalTranscript + interim);
    };

    recognition.onend = () => {
      stream.getTracks().forEach((t) => t.stop());
      setMediaStream(null);
      setIsListening(false);
    };

    recognition.onerror = () => {
      stream.getTracks().forEach((t) => t.stop());
      setMediaStream(null);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [input, onInputChange, speechLang]);

  const cancelListening = useCallback(() => {
    onInputChange(preListenInput);
    stopListening();
  }, [preListenInput, onInputChange, stopListening]);

  const confirmListening = useCallback(() => {
    stopListening();
  }, [stopListening]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const langLabel = SPEECH_LANGUAGES.find((l) => l.code === speechLang)?.label ?? speechLang;
  const btnSize = compact ? 36 : 40;

  if (isListening) {
    return (
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          px: 0,
          py: compact ? 1 : fullHeight ? 0.5 : 2,
          alignItems: 'center',
          flexShrink: 0,
        }}>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            bgcolor: colors.background.paper,
            borderRadius: fullHeight ? 3 : 999,
            border: `1px solid ${colors.grey[300]}`,
            height: compact ? 52 : 56,
            px: 2,
            gap: 1,
          }}>
          <Box sx={{ flex: 1, height: '100%', py: 0.5 }}>
            <AudioWaveform stream={mediaStream} />
          </Box>
        </Box>
        <Tooltip title="Cancel">
          <IconButton
            type="button"
            onClick={cancelListening}
            sx={{
              color: colors.grey[600],
              '&:hover': { bgcolor: colors.grey[100] },
              width: btnSize,
              height: btnSize,
            }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Done">
          <IconButton
            type="button"
            onClick={confirmListening}
            sx={{
              bgcolor: colors.primary.main,
              color: colors.primary.contrastText,
              '&:hover': { bgcolor: colors.primary.dark },
              borderRadius: '50%',
              width: btnSize,
              height: btnSize,
            }}>
            <CheckIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box
      id={compact ? 'chat-composer-compact' : fullHeight ? 'chat-composer-empty' : 'chat-composer'}
      component="form"
      onSubmit={onSubmit}
      sx={{
        display: 'flex',
        gap: 1,
        px: 0,
        py: compact ? 1 : fullHeight ? 0.5 : 2,
        alignItems: compact ? 'center' : 'flex-end',
        flexShrink: 0,
      }}>
      <TextField
        id={compact ? 'chat-composer-input-compact' : fullHeight ? 'chat-composer-input-empty' : 'chat-composer-input'}
        inputRef={inputRef}
        fullWidth
        multiline
        maxRows={compact ? 4 : 6}
        minRows={fullHeight ? 3 : undefined}
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        variant="outlined"
        size={compact ? 'small' : 'medium'}
        disabled={isStreaming}
        slotProps={
          fullHeight
            ? {
                input: {
                  endAdornment: (
                    <InputAdornment position="end" sx={{ alignSelf: 'flex-end', mb: 1, mr: 0.5, gap: 0.5 }}>
                      {speechSupported && (
                        <>
                          <Tooltip title={`Language: ${langLabel}`}>
                            <IconButton
                              type="button"
                              onClick={(e) => setLangMenuAnchor(e.currentTarget)}
                              disabled={isStreaming}
                              sx={{
                                color: colors.grey[500],
                                '&:hover': { bgcolor: colors.grey[100] },
                                '&.Mui-disabled': { color: colors.grey[300] },
                                borderRadius: 2,
                                width: 36,
                                height: 36,
                              }}>
                              <LanguageIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Voice input">
                            <IconButton
                              type="button"
                              onClick={startListening}
                              disabled={isStreaming}
                              sx={{
                                color: colors.grey[500],
                                '&:hover': { bgcolor: colors.grey[100] },
                                '&.Mui-disabled': { color: colors.grey[300] },
                                borderRadius: 2,
                                width: 36,
                                height: 36,
                              }}>
                              <MicIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      <IconButton
                        type={isStreaming ? 'button' : 'submit'}
                        onClick={isStreaming ? onStop : undefined}
                        disabled={isStreaming ? !onStop : !input.trim()}
                        sx={{
                          bgcolor: isStreaming ? colors.error.main : colors.primary.main,
                          color: colors.primary.contrastText,
                          '&:hover': { bgcolor: isStreaming ? colors.error.main : colors.primary.dark },
                          '&.Mui-disabled': { bgcolor: colors.grey[300] },
                          borderRadius: 2,
                          width: 36,
                          height: 36,
                        }}>
                        {isStreaming ? <StopIcon sx={{ fontSize: 18 }} /> : <SendIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }
            : undefined
        }
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: colors.background.paper,
            alignItems: fullHeight ? 'flex-end' : undefined,
            fontSize: fullHeight ? '1rem' : undefined,
            borderRadius: fullHeight ? 3 : undefined,
            boxShadow: compact ? `0 1px 2px ${colors.common.shadow}` : 'none',
            minHeight: compact ? 52 : undefined,
            '& fieldset': {
              borderColor: compact ? colors.grey[300] : undefined,
            },
            '&:hover fieldset': {
              borderColor: compact ? colors.grey[400] : undefined,
            },
            '&.Mui-focused fieldset': {
              borderColor: compact ? colors.primary.light : undefined,
            },
          },
        }}
      />
      {!fullHeight && (
        <>
          {speechSupported && (
            <>
              <Tooltip title={`Language: ${langLabel}`}>
                <IconButton
                  type="button"
                  onClick={(e) => setLangMenuAnchor(e.currentTarget)}
                  disabled={isStreaming}
                  sx={{
                    color: colors.grey[500],
                    '&:hover': { bgcolor: colors.grey[100] },
                    '&.Mui-disabled': { color: colors.grey[300] },
                    borderRadius: '50%',
                    alignSelf: 'center',
                    mt: compact ? -0.25 : 0,
                    width: btnSize,
                    height: btnSize,
                  }}>
                  <LanguageIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Voice input">
                <IconButton
                  type="button"
                  onClick={startListening}
                  disabled={isStreaming}
                  sx={{
                    color: colors.grey[500],
                    '&:hover': { bgcolor: colors.grey[100] },
                    '&.Mui-disabled': { color: colors.grey[300] },
                    borderRadius: '50%',
                    alignSelf: 'center',
                    mt: compact ? -0.25 : 0,
                    width: btnSize,
                    height: btnSize,
                  }}>
                  <MicIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          <IconButton
            id={compact ? 'chat-composer-submit-compact' : 'chat-composer-submit'}
            type={isStreaming ? 'button' : 'submit'}
            onClick={isStreaming ? onStop : undefined}
            disabled={isStreaming ? !onStop : !input.trim()}
            sx={{
              bgcolor: isStreaming ? colors.error.main : colors.primary.main,
              color: colors.primary.contrastText,
              '&:hover': { bgcolor: isStreaming ? colors.error.main : colors.primary.dark },
              '&.Mui-disabled': { bgcolor: colors.grey[300] },
              borderRadius: '50%',
              alignSelf: 'center',
              mt: compact ? -0.25 : 0,
              width: btnSize,
              height: btnSize,
            }}>
            {isStreaming ? <StopIcon fontSize="small" /> : <SendIcon fontSize="small" />}
          </IconButton>
        </>
      )}
      <Menu
        anchorEl={langMenuAnchor}
        open={Boolean(langMenuAnchor)}
        onClose={() => setLangMenuAnchor(null)}
        slotProps={{ paper: { sx: { maxHeight: 300 } } }}>
        {SPEECH_LANGUAGES.map((lang) => (
          <MenuItem
            key={lang.code}
            selected={lang.code === speechLang}
            onClick={() => {
              setSpeechLang(lang.code);
              setLangMenuAnchor(null);
            }}>
            {lang.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
