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
  declineInvitation as declineInvitationApi,
  listInvitations as listInvitationsApi,
} from '../api/invitations';
import type { Invitation } from '../api/invitations';
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
 * Value exposed by {@link useInvitations}.
 *
 * - `invitations` — the live pending list (seeded from REST on connect,
 *   reconciled by the STOMP `INVITATION_RECEIVED` / `INVITATION_CANCELLED`
 *   pushes). Empty for a guest.
 * - `accept(roomId)` — accept the invitation: joins the room, enters it
 *   (`enterRoom`), navigates to `/play`, and drops it from the list.
 * - `decline(roomId)` — decline it: deletes server-side and drops it.
 *
 * Both actions surface failures by throwing the mapped `ApiError` so the
 * caller (the Header panel) can show a Snackbar; on success the list update
 * is applied here.
 */
export type InvitationsContextValue = Readonly<{
  invitations: ReadonlyArray<Invitation>;
  accept: (roomId: string) => Promise<void>;
  decline: (roomId: string) => Promise<void>;
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
 *   `INVITATION_DECLINED` is inviter-side and ignored here (handled in
 *   `direct-invitations-send`).
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
        case InvitationQueueEventType.Declined:
          // Inviter-side; consumed by direct-invitations-send (26.98).
          return;
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
    };
  }, [userId]);

  const removeByRoomId = useCallback((roomId: string) => {
    setInvitations((prev) => prev.filter((inv) => inv.roomId !== roomId));
  }, []);

  const accept = useCallback(
    async (roomId: string) => {
      const response = await acceptInvitationApi(roomId);
      enterRoom(response);
      removeByRoomId(roomId);
      navigate('/play');
    },
    [enterRoom, navigate, removeByRoomId],
  );

  const decline = useCallback(
    async (roomId: string) => {
      await declineInvitationApi(roomId);
      removeByRoomId(roomId);
    },
    [removeByRoomId],
  );

  const value = useMemo<InvitationsContextValue>(
    () => ({ invitations, accept, decline }),
    [invitations, accept, decline],
  );

  return <InvitationsContext.Provider value={value}>{children}</InvitationsContext.Provider>;
};

export default InvitationsContext;
