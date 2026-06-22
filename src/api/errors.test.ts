import { describe, expect, it } from 'vitest';
import { ApiError, ApiErrorCode, errorMessages, mapError, messageFor } from './errors';

describe('mapError', () => {
  it('promotes a recognised server error code to a typed ApiError', () => {
    const response = new Response(null, { status: 404 });
    const result = mapError({ error: ApiErrorCode.RoomNotFound, message: 'nope' }, response);

    expect(result).toBeInstanceOf(ApiError);
    expect(result.code).toBe(ApiErrorCode.RoomNotFound);
    expect(result.httpStatus).toBe(404);
    expect(result.serverMessage).toBe('nope');
  });

  it('promotes AUTHENTICATION_REQUIRED to a typed ApiError', () => {
    const response = new Response(null, { status: 401 });
    const result = mapError({ error: ApiErrorCode.AuthenticationRequired }, response);

    expect(result.code).toBe(ApiErrorCode.AuthenticationRequired);
    expect(result.httpStatus).toBe(401);
  });

  it('promotes EMAIL_ALREADY_TAKEN to a typed ApiError', () => {
    const response = new Response(null, { status: 409 });
    const result = mapError({ error: ApiErrorCode.EmailAlreadyTaken }, response);

    expect(result.code).toBe(ApiErrorCode.EmailAlreadyTaken);
  });

  it('promotes INVALID_CREDENTIALS to a typed ApiError', () => {
    const response = new Response(null, { status: 401 });
    const result = mapError({ error: ApiErrorCode.InvalidCredentials }, response);

    expect(result.code).toBe(ApiErrorCode.InvalidCredentials);
  });

  it('promotes INVALID_JOIN_TOKEN to a typed ApiError', () => {
    const response = new Response(null, { status: 403 });
    const result = mapError({ error: ApiErrorCode.InvalidJoinToken }, response);

    expect(result.code).toBe(ApiErrorCode.InvalidJoinToken);
    expect(result.httpStatus).toBe(403);
  });

  it('falls back to UNKNOWN_ERROR for an unrecognised body', () => {
    const response = new Response(null, { status: 500 });
    const result = mapError({ something: 'else' }, response);

    expect(result.code).toBe(ApiErrorCode.UnknownError);
    expect(result.httpStatus).toBe(500);
  });
});

describe('messageFor', () => {
  it('returns a user-facing message for every code in the const object', () => {
    for (const code of Object.values(ApiErrorCode)) {
      expect(messageFor(code).length).toBeGreaterThan(0);
    }
  });

  it('returns the dedicated message for the new auth codes', () => {
    expect(messageFor(ApiErrorCode.AuthenticationRequired)).toBe(
      errorMessages[ApiErrorCode.AuthenticationRequired],
    );
    expect(messageFor(ApiErrorCode.InvalidCredentials)).toBe('Incorrect email or password.');
  });
});
