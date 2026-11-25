import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { createRepository } from '@/data/createRepository';
import type { ShelflyRepository } from '@/data/repository';
import type { Actor, DataMode, MagicLinkResult, MembershipSummary } from '@/domain/types';
import { registerForPush, type PushRegistration } from '@/notifications/push';

interface WorkspaceValue {
  ready: boolean;
  actor: Actor | null;
  memberships: MembershipSummary[];
  activeWorkspace: MembershipSummary | null;
  mode: DataMode;
  online: boolean;
  stale: boolean;
  /** Bumps after every write or session change. Screens list it in their load deps to refresh. */
  revision: number;
  push: PushRegistration | null;
  repo: ShelflyRepository;
  signIn: (email: string, password: string) => Promise<void>;
  requestMagicLink: (email: string) => Promise<MagicLinkResult>;
  consumeMagicLink: (token: string) => Promise<void>;
  enterDemo: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchWorkspace: (tenantId: string) => Promise<void>;
  commit: <T>(work: () => Promise<T>) => Promise<T>;
  enablePush: () => Promise<PushRegistration>;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children, repository }: { children: ReactNode; repository?: ShelflyRepository }) {
  const flags = useMemo(() => {
    const state = { stale: false };
    return {
      read: () => state.stale,
      mark(value: boolean) {
        state.stale = value;
      },
    };
  }, []);
  const onlineRef = useMemo(() => ({ current: true }), []);
  const repo = useMemo(
    () => repository ?? createRepository({ flags, isOnline: () => onlineRef.current }),
    [flags, onlineRef, repository],
  );
  const [ready, setReady] = useState(false);
  const [actor, setActor] = useState<Actor | null>(null);
  const [memberships, setMemberships] = useState<MembershipSummary[]>([]);
  const [online, setOnline] = useState(true);
  const [stale, setStale] = useState(false);
  const [revision, setRevision] = useState(0);
  const [push, setPush] = useState<PushRegistration | null>(null);

  const sync = useCallback(async () => {
    const next = await repo.currentActor();
    setActor(next);
    setMemberships(next ? await repo.listMemberships().catch(() => []) : []);
    setStale(flags.read());
    setRevision((value) => value + 1);
  }, [flags, repo]);

  useEffect(() => {
    let cancelled = false;
    repo
      .restore()
      .then(async (session) => {
        if (cancelled) return;
        setActor(session);
        if (session) {
          const seats = await repo.listMemberships().catch(() => []);
          if (!cancelled) setMemberships(seats);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected !== false;
      onlineRef.current = connected;
      setOnline(connected);
    });
    return () => unsubscribe();
  }, [onlineRef]);

  const commit = useCallback(
    async <T,>(work: () => Promise<T>) => {
      const result = await work();
      await sync();
      return result;
    },
    [sync],
  );

  const enablePush = useCallback(async () => {
    const registration = await registerForPush();
    setPush(registration);
    if (await repo.currentActor()) {
      await repo.registerPushToken(registration.token, registration.mode).catch(() => undefined);
    }
    return registration;
  }, [repo]);

  const value = useMemo<WorkspaceValue>(
    () => ({
      ready,
      actor,
      memberships,
      activeWorkspace: memberships.find((seat) => seat.tenantId === actor?.activeTenantId) ?? null,
      mode: repo.mode,
      online,
      stale,
      revision,
      push,
      repo,
      signIn: (email, password) => commit(() => repo.signInWithPassword(email, password)).then(() => undefined),
      requestMagicLink: (email) => repo.requestMagicLink(email),
      consumeMagicLink: (token) => commit(() => repo.consumeMagicLink(token)).then(() => undefined),
      enterDemo: (userId) => commit(() => repo.signInAsDemo(userId)).then(() => undefined),
      signOut: () => commit(() => repo.signOut()).then(() => undefined),
      switchWorkspace: (tenantId) => commit(() => repo.switchWorkspace(tenantId)).then(() => undefined),
      commit,
      enablePush,
    }),
    [actor, commit, enablePush, memberships, online, push, ready, repo, revision, stale],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}
