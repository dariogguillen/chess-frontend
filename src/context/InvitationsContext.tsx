import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  acceptInvitation as acceptInvitationApi,
  cancelInvitation as cancelInvitationApi,
  declineInvitation as declineInvitationApi,
  listInvitations as listInvitationsApi,
  sendInvitation as sendInvitationApi,
} from '../api/invitations';
import type { Invitation } from '../api/invitations';
import { ApiError, ApiErrorCode, messageFor } from '../api/errors';
import { Side } from '../api/games';
import { InvitationQueueEventType } from '../api/wsEvents';
import type { InvitationQueueEvent } from '../api/wsEvents';
import { readToken } from '../utils/authToken';
import { wsUrl } from '../utils/config.default';
import { createStompClient } from '../utils/ws';
import type { StompClient, StompClientConfig } from '../utils/ws';
import { IdentityKind, useUserContext } from './UserContext';

/**
 * Destination for the authenticated user's personal invitations queue. The
 * broker's `/user` prefix maps it to the session Principal resolved from the
 * `Authorization: Bearer <jwt>` CONNECT header — so two different signed-in
 * users subscribing the same path each receive only their own pushes.
 */
const INVITATIONS_QUEUE = '/user/queue/invitations';

/**
 * Factory shape for the underlying STOMP client (the same seam
 * `useGameStomp` uses): production points at `createStompClient`; tests
 * inject a factory returning a `MockStompClient`.
 */
export type InvitationsStompFactory = (config: StompClientConfig) => StompClient;

/**
 * One invitation the local user has SENT and is still waiting on, tracked
 * LOCALLY in the provider. There is no backend list-sent endpoint, so this
 * state is session-only — it is seeded by {@link InvitationsContextValue.invite}
 * and pruned by a cancel, an accept (the room fills, surfaced elsewhere), or
 * the inviter-side `INVITATION_DECLINED` push. A refresh loses it, which is
 * acceptable: you invite while waiting in the room, so the window is short.
 */
export type OutgoingInvitation = Readonly<{
  roomId: string;
  inviteeUserId: string;
  inviteeDisplayName: string;
}>;

/**
 * Value exposed by {@link useInvitations}.
 *
 * Receive side (26.97):
 * - `invitations` — the live pending INCOMING list (seeded from REST on
 *   connect, reconciled by the STOMP `INVITATION_RECEIVED` /
 *   `INVITATION_CANCELLED` pushes). Empty for a guest.
 * - `accept(roomId)` — accept: joins the room, enters it (`enterRoom`),
 *   navigates to `/play`, and drops it from the list.
 * - `decline(roomId)` — decline: deletes server-side and drops it.
 *
 * Send side (26.98):
 * - `outgoing` — the SENT invitations the user is still waiting on, tracked
 *   locally (no backend backing — session state). The Play room renders the
 *   subset for its own room.
 * - `invite(roomId, friendUserId, friendDisplayName)` — POST the invitation
 *   and, on success, add it to `outgoing`. Re-throws the mapped `ApiError`
 *   so the caller can Snackbar (e.g. `ROOM_FULL`).
 * - `cancelOutgoing(roomId, inviteeUserId)` — DELETE the invitation and drop
 *   it from `outgoing`. Re-throws on failure.
 *
 * Notice channel (app-level Snackbar):
 * - `notice` — a transient message (e.g. "Alice declined your invitation" or
 *   an accept-failure) or `null`. Set when an `INVITATION_DECLINED` push
 *   arrives or a background op fails; an app-level Snackbar announces it.
 * - `clearNotice()` — dismiss the current notice.
 */
export type InvitationsContextValue = Readonly<{
  invitations: ReadonlyArray<Invitation>;
  accept: (roomId: string) => Promise<void>;
  decline: (roomId: string) => Promise<void>;
  outgoing: ReadonlyArray<OutgoingInvitation>;
  invite: (roomId: string, friendUserId: string, friendDisplayName: string) => Promise<void>;
  cancelOutgoing: (roomId: string, inviteeUserId: string) => Promise<void>;
  notice: string | null;
  clearNotice: () => void;
}>;

const InvitationsContext = createContext<InvitationsContextValue | undefined>(undefined);

export const useInvitations = (): InvitationsContextValue => {
  const context = useContext(InvitationsContext);
  if (context === undefined) {
    throw new Error('useInvitations must be used within an InvitationsProvider');
  }
  return context;
};

export type InvitationsProviderProps = Readonly<{
  children: ReactNode;
  /** Override the WS URL. Test-only. */
  wsUrl?: string;
  /** Override the STOMP client factory. Test-only. */
  clientFactory?: InvitationsStompFactory;
  /** Override the REST seed call. Test-only. */
  listInvitations?: typeof listInvitationsApi;
}>;

/**
 * App-level provider for direct invitations. Mounted INSIDE
 * `UserContextProvider` (it reads `identity` + `enterRoom`) but it owns a
 * STOMP connection that is SEPARATE from the per-game one in `useGameStomp`:
 * different auth (a Bearer JWT on the CONNECT frame vs. a `playerId`
 * SUBSCRIBE header), different destination (a personal `/user/queue/...` vs.
 * a public `/topic/games/...`), and a different lifetime (the whole session
 * vs. one game).
 *
 * Behaviour:
 * - Guest (or any non-Authenticated identity) → no connection, empty list.
 * - Authenticated → build a client with `connectHeaders: { Authorization:
 *   'Bearer <jwt>' }`, connect, subscribe to `/user/queue/invitations`, and
 *   seed the pending list with `listInvitations()`. Live: `INVITATION_RECEIVED`
 *   adds (de-duped by roomId), `INVITATION_CANCELLED` removes by roomId.
 *   `INVITATION_DECLINED` is inviter-side — it drops the matching `outgoing`
 *   entry and stages a notice ("X declined your invitation").
 * - On unmount, or when identity flips back to guest (logout), the effect's
 *   cleanup unsubscribes + disconnects and clears the list.
 *
 * The effect keys on the authenticated user's id, so a different user
 * signing in tears down the previous connection and opens a fresh one.
 */
export const InvitationsProvider = ({
  children,
  wsUrl: wsUrlOverride,
  clientFactory,
  listInvitations = listInvitationsApi,
}: InvitationsProviderProps) => {
  const { identity, enterRoom } = useUserContext();
  const navigate = useNavigate();

  const [invitations, setInvitations] = useState<ReadonlyArray<Invitation>>([]);
  // SENT invitations the user is still waiting on. Session-only (no backend
  // list-sent endpoint); reconciled by invite / cancel / the DECLINED push.
  const [outgoing, setOutgoing] = useState<ReadonlyArray<OutgoingInvitation>>([]);
  // App-level notice channel (a declined invite, an accept/send failure). A
  // single Snackbar reads it; null when there is nothing to announce.
  const [notice, setNotice] = useState<string | null>(null);
  const clearNotice = useCallback(() => setNotice(null), []);

  // A mirror of `outgoing` for the STOMP handler, which lives inside the
  // connect effect and must read the current list (e.g. to resolve the
  // invitee's display name when an INVITATION_DECLINED push arrives) without
  // re-subscribing every time the list changes. Synced in an effect rather
  // than during render (the latter trips react-hooks/refs); a one-render lag
  // is harmless here because an outgoing row is always committed well before
  // the matching declined push can arrive.
  const outgoingRef = useRef(outgoing);
  useEffect(() => {
    outgoingRef.current = outgoing;
  }, [outgoing]);

  // Pin the test-injection options on first render — they are mount-time
  // facts in production (the defaults) and frozen up front in tests. Keeping
  // them in a ref means the connect effect depends only on the identity, not
  // on prop identity that React might re-create.
  const optionsRef = useRef({ wsUrlOverride, clientFactory, listInvitations });

  const userId = identity.kind === IdentityKind.Authenticated ? identity.userId : null;

  useEffect(() => {
    if (userId === null) {
      // Guest: nothing to connect. The list is already empty on first
      // mount; on a logout transition the previous effect's cleanup reset
      // it, so no setState is needed here.
      return;
    }

    const token = readToken();
    if (token === null) {
      // Authenticated identity but no persisted credential (degraded
      // storage). Without a Bearer header the broker cannot resolve the
      // Principal, so skip the connection rather than open an unauthorised
      // one that the backend would reject.
      return;
    }

    const url = optionsRef.current.wsUrlOverride ?? wsUrl;
    const factory = optionsRef.current.clientFactory ?? createStompClient;
    const seed = optionsRef.current.listInvitations;

    let cancelled = false;
    const client = factory({
      url,
      reconnectDelay: 5000,
      connectHeaders: { Authorization: `Bearer ${token}` },
    });

    const applyEvent = (event: InvitationQueueEvent): void => {
      switch (event.type) {
        case InvitationQueueEventType.Received:
          setInvitations((prev) => {
            // De-dupe by roomId: a push can race the REST seed, and the
            // backend re-sends the same (room, invitee) idempotently.
            if (prev.some((inv) => inv.roomId === event.roomId)) return prev;
            return [
              ...prev,
              {
                roomId: event.roomId,
                inviterUserId: event.inviterUserId,
                inviterDisplayName: event.inviterDisplayName,
                timeControl: event.timeControl,
                // The push event carries neither `side` nor `createdAt`;
                // default them so the entry is renderable. The next REST
                // refresh (or the panel itself) does not depend on them.
                side: Side.Black,
                createdAt: new Date().toISOString(),
              },
            ];
          });
          return;
        case InvitationQueueEventType.Cancelled:
          setInvitations((prev) => prev.filter((inv) => inv.roomId !== event.roomId));
          return;
        case InvitationQueueEventType.Declined: {
          // Inviter-side: an invitee rejected. Drop the matching outgoing
          // entry and announce it. The wire event carries only ids, so we
          // resolve the invitee's display name from the live `outgoing`
          // mirror (the ref) to build a friendly notice.
          const { roomId, inviteeUserId } = event;
          const match = outgoingRef.current.find(
            (out) => out.roomId === roomId && out.inviteeUserId === inviteeUserId,
          );
          setNotice(
            match !== undefined
              ? `${match.inviteeDisplayName} declined your invitation.`
              : 'Your invitation was declined.',
          );
          setOutgoing((prev) =>
            prev.filter((out) => !(out.roomId === roomId && out.inviteeUserId === inviteeUserId)),
          );
          return;
        }
        default: {
          const _exhaustive: never = event;
          void _exhaustive;
          return;
        }
      }
    };

    let unsubscribe: (() => void) | null = null;

    const run = async () => {
      try {
        await client.connect();
        if (cancelled) return;
        unsubscribe = client.subscribe<InvitationQueueEvent>(INVITATIONS_QUEUE, applyEvent);
        // Seed the pending list from REST. The subscribe is set up first so
        // a push that races the GET is not lost; the de-dupe in
        // `applyEvent` reconciles an overlap.
        const seeded = await seed();
        if (cancelled) return;
        setInvitations((prev) => {
          const known = new Set(prev.map((inv) => inv.roomId));
          const merged = [...prev];
          for (const inv of seeded) {
            if (!known.has(inv.roomId)) merged.push(inv);
          }
          return merged;
        });
      } catch {
        // A failed connect / seed leaves the list empty; the badge simply
        // shows nothing. The per-game connection is unaffected (separate
        // client). No user-facing error for a passive background channel.
      }
    };
    void run();

    return () => {
      cancelled = true;
      unsubscribe?.();
      void client.disconnect();
      setInvitations([]);
      // The outgoing list is identity-scoped too: a logout (or a different
      // user signing in) must not leak the previous session's sent invites.
      setOutgoing([]);
    };
  }, [userId]);

  const removeByRoomId = useCallback((roomId: string) => {
    setInvitations((prev) => prev.filter((inv) => inv.roomId !== roomId));
  }, []);

  // Map any thrown value to a user-facing string for the notice channel: an
  // ApiError reads its mapped code; anything else is the generic copy.
  const noticeFor = useCallback(
    (error: unknown): string =>
      error instanceof ApiError ? messageFor(error.code) : messageFor(ApiErrorCode.UnknownError),
    [],
  );

  const accept = useCallback(
    async (roomId: string) => {
      try {
        const response = await acceptInvitationApi(roomId);
        enterRoom(response);
        removeByRoomId(roomId);
        navigate('/play');
      } catch (error) {
        // 26.97 polish: an accept failure (e.g. the room filled before we
        // accepted) must not be swallowed — surface it on the notice channel.
        // Drop the now-stale entry so the panel does not offer a dead retry.
        removeByRoomId(roomId);
        setNotice(noticeFor(error));
        throw error;
      }
    },
    [enterRoom, navigate, removeByRoomId, noticeFor],
  );

  const decline = useCallback(
    async (roomId: string) => {
      try {
        await declineInvitationApi(roomId);
        removeByRoomId(roomId);
      } catch (error) {
        setNotice(noticeFor(error));
        throw error;
      }
    },
    [removeByRoomId, noticeFor],
  );

  const invite = useCallback(
    async (roomId: string, friendUserId: string, friendDisplayName: string) => {
      // Let the throw propagate so the caller (Play / FriendsSection) can
      // Snackbar the specific error; only mutate `outgoing` on success.
      await sendInvitationApi(roomId, friendUserId);
      setOutgoing((prev) => {
        // De-dupe by (roomId, inviteeUserId): re-inviting the same friend is
        // idempotent server-side, so the local row must not double up.
        if (prev.some((out) => out.roomId === roomId && out.inviteeUserId === friendUserId)) {
          return prev;
        }
        return [
          ...prev,
          { roomId, inviteeUserId: friendUserId, inviteeDisplayName: friendDisplayName },
        ];
      });
    },
    [],
  );

  const cancelOutgoing = useCallback(async (roomId: string, inviteeUserId: string) => {
    await cancelInvitationApi(roomId, inviteeUserId);
    setOutgoing((prev) =>
      prev.filter((out) => !(out.roomId === roomId && out.inviteeUserId === inviteeUserId)),
    );
  }, []);

  const value = useMemo<InvitationsContextValue>(
    () => ({
      invitations,
      accept,
      decline,
      outgoing,
      invite,
      cancelOutgoing,
      notice,
      clearNotice,
    }),
    [invitations, accept, decline, outgoing, invite, cancelOutgoing, notice, clearNotice],
  );

  return <InvitationsContext.Provider value={value}>{children}</InvitationsContext.Provider>;
};

export default InvitationsContext;
