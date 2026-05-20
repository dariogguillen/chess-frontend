import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { createMockStompClient } from '../utils/ws';
import type { MockStompClient } from '../utils/ws';
import { useStompSubscription } from './useStompSubscription';

interface MoveEvent {
  gameId: string;
  moveNumber: number;
}

const Subscriber = ({
  client,
  topic,
  onMessage,
}: {
  client: MockStompClient;
  topic: string;
  onMessage: (m: MoveEvent) => void;
}) => {
  useStompSubscription<MoveEvent>(client, topic, onMessage);
  return <div>subscribed</div>;
};

describe('useStompSubscription', () => {
  it('invokes the handler when a message is dispatched to the topic', () => {
    const client = createMockStompClient();
    const handler = vi.fn();

    render(<Subscriber client={client} topic="/topic/games/abc" onMessage={handler} />);

    act(() => {
      client.dispatch<MoveEvent>('/topic/games/abc', { gameId: 'abc', moveNumber: 1 });
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ gameId: 'abc', moveNumber: 1 });
  });

  it('stops invoking the handler after unmount', () => {
    const client = createMockStompClient();
    const handler = vi.fn();

    const view = render(
      <Subscriber client={client} topic="/topic/games/abc" onMessage={handler} />,
    );
    act(() => {
      client.dispatch<MoveEvent>('/topic/games/abc', { gameId: 'abc', moveNumber: 1 });
    });
    expect(handler).toHaveBeenCalledTimes(1);

    view.unmount();
    act(() => {
      client.dispatch<MoveEvent>('/topic/games/abc', { gameId: 'abc', moveNumber: 2 });
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not re-subscribe when the handler closure identity changes', async () => {
    const client = createMockStompClient();
    const subscribeSpy = vi.spyOn(client, 'subscribe');
    const sink: MoveEvent[] = [];

    // A parent that bumps a state counter on each click, which changes the
    // identity of the inline `onMessage` closure passed to the subscriber.
    const Parent = () => {
      const [count, setCount] = useState(0);
      return (
        <>
          <button onClick={() => setCount((c) => c + 1)}>bump {count}</button>
          <Subscriber
            client={client}
            topic="/topic/games/abc"
            onMessage={(m) => sink.push({ ...m, moveNumber: m.moveNumber + count })}
          />
        </>
      );
    };

    render(<Parent />);
    expect(subscribeSpy).toHaveBeenCalledTimes(1);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /bump/i }));
    await user.click(screen.getByRole('button', { name: /bump/i }));

    // Despite three different closure identities (initial + two bumps),
    // the underlying mock saw exactly one subscribe call.
    expect(subscribeSpy).toHaveBeenCalledTimes(1);

    // And the latest closure is in fact the one running on dispatch — the
    // ref keeps pointing at the freshest handler.
    act(() => {
      client.dispatch<MoveEvent>('/topic/games/abc', { gameId: 'abc', moveNumber: 10 });
    });
    expect(sink).toEqual([{ gameId: 'abc', moveNumber: 12 }]); // count == 2
  });
});
