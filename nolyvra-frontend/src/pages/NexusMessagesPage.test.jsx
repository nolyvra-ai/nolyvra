import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import NexusMessagesPage from './NexusMessagesPage';

const threads = ['A', 'B'].map(id => ({ id, candidateId: id, displayName: `Person ${id}`, createdAt: '2026-09-01' }));
const response = data => ({ ok: true, json: async () => data });
const message = body => [{ id: body, body, sender: 'CANDIDATE', sentAt: '2026-09-01' }];
let bodies;
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.setItem('loginId', 'recruiter');
  bodies = { A: 'first A', B: 'first B' };
  vi.stubGlobal('fetch', vi.fn(async url => {
    const match = url.match(/threads\/(.)\/messages/);
    return response(match ? message(bodies[match[1]]) : threads);
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); });
async function mount() { await act(async () => { render(<NexusMessagesPage />); }); }
async function select(id) { await act(async () => { fireEvent.click(screen.getByText(`Person ${id}`)); }); }

it('refreshes incoming messages and new threads without clearing the reply draft', async () => {
  await mount();
  await select('A');
  fireEvent.change(screen.getByPlaceholderText('Write a reply…'), { target: { value: 'draft' } });
  bodies.A = 'new incoming';
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(screen.getByText('new incoming')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Write a reply…')).toHaveValue('draft');
  expect(fetch.mock.calls.filter(([url]) => url.includes('/threads?'))).toHaveLength(2);
});

it('ignores a delayed response from a previously selected conversation', async () => {
  await mount();
  let resolveA;
  fetch.mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; }));
  await select('A');
  await select('B');
  await act(async () => { resolveA(response(message('late A'))); });
  expect(screen.getByText('first B')).toBeInTheDocument();
  expect(screen.queryByText('late A')).not.toBeInTheDocument();
});

it('does not switch back when a send finishes after selecting another conversation', async () => {
  await mount();
  await select('A');
  fireEvent.change(screen.getByPlaceholderText('Write a reply…'), { target: { value: 'outgoing' } });
  let finishSend;
  fetch.mockImplementationOnce(() => new Promise(resolve => { finishSend = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await select('B');
  await act(async () => { finishSend(response({})); });
  expect(screen.getByText('first B')).toBeInTheDocument();
  expect(screen.queryByText('first A')).not.toBeInTheDocument();
});

it('stops polling after unmount', async () => {
  await mount();
  cleanup();
  const calls = fetch.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(fetch).toHaveBeenCalledTimes(calls);
});
