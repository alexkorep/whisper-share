import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTranscription, UseTranscriptionParams } from './useTranscription';

// Mocks
const mockOnSaveTranscription = vi.fn();
const mockOnStatus = vi.fn();
const mockFetch = vi.fn();
const mockFFmpeg = {
  on: vi.fn(),
  load: vi.fn(),
  writeFile: vi.fn(),
  exec: vi.fn(),
  readFile: vi.fn(),
  deleteFile: vi.fn(),
};

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: vi.fn(() => mockFFmpeg),
}));
vi.mock('@ffmpeg/util', () => ({
  fetchFile: vi.fn(async (file: any) => file),
}));

globalThis.fetch = mockFetch;

describe('useTranscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockFFmpeg.load as any).mockResolvedValue(undefined);
    (mockFFmpeg.writeFile as any).mockResolvedValue(undefined);
    (mockFFmpeg.exec as any).mockResolvedValue(undefined);
    (mockFFmpeg.readFile as any).mockResolvedValue(new Uint8Array([1,2,3]));
    (mockFFmpeg.deleteFile as any).mockResolvedValue(undefined);
  });

  const params: UseTranscriptionParams = {
    apiKey: 'test-key',
    onSaveTranscription: mockOnSaveTranscription,
    onStatus: mockOnStatus,
    selectedApi: 'gpt4o',
    language: 'en',
  };

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useTranscription(params));
    expect(result.current.transcription).toBe('');
    expect(result.current.transcribing).toBe(false);
  });

  it('should handle missing apiKey', async () => {
    const { result } = renderHook(() => useTranscription({ ...params, apiKey: '' }));
    await act(async () => {
      await result.current.transcribe(new File(['abc'], 'test.mp3'));
    });
    expect(mockOnStatus).toHaveBeenCalledWith('Error: OpenAI API Key is not set.', 'error');
  });

  it('should convert non-mp3 file and transcribe', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'transcribed text' } }],
        usage: { prompt_tokens: 1000, completion_tokens: 2000 },
      }),
    });
    const { result } = renderHook(() => useTranscription(params));
    const file = new File(['abc'], 'test.wav');
    await act(async () => {
      await result.current.transcribe(file);
    });
    expect(mockFFmpeg.writeFile).toHaveBeenCalled();
    expect(mockOnSaveTranscription).toHaveBeenCalledWith({ filename: 'test.wav', text: 'transcribed text' });
    expect(result.current.transcription).toBe('transcribed text');
  });

  it('should handle mp3 file without conversion', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'mp3 text' } }],
      }),
    });
    const { result } = renderHook(() => useTranscription(params));
    const file = new File(['abc'], 'audio.mp3');
    await act(async () => {
      await result.current.transcribe(file);
    });
    expect(mockFFmpeg.writeFile).not.toHaveBeenCalled();
    expect(result.current.transcription).toBe('mp3 text');
  });

  it('should handle API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'fail' } }),
    });
    const { result } = renderHook(() => useTranscription(params));
    const file = new File(['abc'], 'audio.mp3');
    await act(async () => {
      await result.current.transcribe(file);
    });
    expect(result.current.transcription).toMatch(/Error/);
    expect(mockOnStatus).toHaveBeenCalledWith(expect.stringMatching(/Error/), 'error');
  });
});
