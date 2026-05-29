import { describe, it, expect } from 'vitest';
import { ROOM_ID_ALPHABET, ROOM_ID_LENGTH, isValidRoomIdFormat, normalizeRoomId } from './roomId';

describe('roomId format helper', () => {
  describe('isValidRoomIdFormat', () => {
    it('accepts a well-formed 6-char code from the alphabet', () => {
      expect(isValidRoomIdFormat('K7M3X9')).toBe(true);
    });

    it('accepts lower-case input (server is case-insensitive)', () => {
      expect(isValidRoomIdFormat('k7m3x9')).toBe(true);
    });

    it('trims surrounding whitespace before validating', () => {
      expect(isValidRoomIdFormat('  K7M3X9  ')).toBe(true);
    });

    it('rejects an empty string', () => {
      expect(isValidRoomIdFormat('')).toBe(false);
    });

    it('rejects a too-short code', () => {
      expect(isValidRoomIdFormat('K7M3X')).toBe(false);
    });

    it('rejects a too-long code', () => {
      expect(isValidRoomIdFormat('K7M3X99')).toBe(false);
    });

    it('rejects characters outside the alphabet (I, L, O, 0, 1)', () => {
      expect(isValidRoomIdFormat('IL0O01')).toBe(false);
    });

    it('rejects punctuation', () => {
      expect(isValidRoomIdFormat('K7-3X9')).toBe(false);
    });
  });

  describe('normalizeRoomId', () => {
    it('upper-cases and trims', () => {
      expect(normalizeRoomId('  k7m3x9 ')).toBe('K7M3X9');
    });

    it('clamps to the room-id length', () => {
      expect(normalizeRoomId('k7m3x9zzz')).toBe('K7M3X9');
    });

    it('leaves a canonical code unchanged', () => {
      expect(normalizeRoomId('K7M3X9')).toBe('K7M3X9');
    });
  });

  describe('exported constants', () => {
    it('mirrors the backend alphabet and length', () => {
      expect(ROOM_ID_ALPHABET).toBe('ABCDEFGHJKMNPQRSTUVWXYZ23456789');
      expect(ROOM_ID_LENGTH).toBe(6);
    });
  });
});
