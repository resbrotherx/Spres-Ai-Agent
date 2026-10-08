import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrainboxReactSDK } from './brainbox-sdk';
import { toBrainboxError } from './brainbox-sdk';
import type {
  ApiSourceConfig,
  TrainFileOptions,
  TrainingAudience,
  TrainingSource,
  TrainingTaskResponse,
  UpdateTrainingSourcePayload,
  UseBrainboxTrainingHook
} from './types';

const POLL_INTERVAL_MS = 3000;

const isActive = (s: TrainingSource) => s.status === 'queued' || s.status === 'processing';

/**
 * State + actions for managing the AI's training sources (files, pasted text, third-party APIs).
 * Polls the source list every ~3s while any source is queued or processing.
 */
export function useBrainboxTraining(sdk: BrainboxReactSDK): UseBrainboxTrainingHook {
  const [sources, setSources] = useState<TrainingSource[]>([]);
  const [totals, setTotals] = useState({ sources: 0, documents: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const data = await sdk.listSources();
      if (!mounted.current) return;
      const list = Array.isArray(data?.sources) ? data.sources : [];
      setSources(list);
      setTotals(
        data?.totals ?? {
          sources: list.length,
          documents: list.reduce((n, s) => n + (s.documents_count || 0), 0)
        }
      );
      setError(null);
    } catch (err) {
      if (mounted.current) setError(toBrainboxError(err).message);
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [sdk]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const hasActive = sources.some(isActive);
  useEffect(() => {
    if (!hasActive) return undefined;
    const id = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasActive, refresh]);

  /** Insert/replace a source locally so it shows up immediately, then refresh from the server. */
  const upsert = useCallback(
    (res: TrainingTaskResponse) => {
      const src = res?.source;
      if (src && mounted.current) {
        setSources((prev) => {
          const idx = prev.findIndex((s) => s.source_id === src.source_id);
          if (idx === -1) return [src, ...prev];
          const next = prev.slice();
          next[idx] = src;
          return next;
        });
      }
      void refresh();
      return res;
    },
    [refresh]
  );

  const trainFile = useCallback(
    async (file: File, options?: TrainFileOptions) => upsert(await sdk.trainFile(file, options)),
    [sdk, upsert]
  );

  const trainText = useCallback(
    async (name: string, content: string, audience?: TrainingAudience) =>
      upsert(await sdk.trainText(name, content, audience)),
    [sdk, upsert]
  );

  const testApiSource = useCallback((config: ApiSourceConfig) => sdk.testApiSource(config), [sdk]);

  const addApiSource = useCallback(
    async (config: ApiSourceConfig) => upsert(await sdk.addApiSource(config)),
    [sdk, upsert]
  );

  const syncSource = useCallback(
    async (sourceId: string) => upsert(await sdk.syncSource(sourceId)),
    [sdk, upsert]
  );

  const deleteSource = useCallback(
    async (sourceId: string) => {
      const res = await sdk.deleteSource(sourceId);
      if (mounted.current) setSources((prev) => prev.filter((s) => s.source_id !== sourceId));
      void refresh();
      return res;
    },
    [sdk, refresh]
  );

  const updateSource = useCallback(
    async (sourceId: string, patch: UpdateTrainingSourcePayload) => {
      const updated = await sdk.updateSource(sourceId, patch);
      if (updated && mounted.current) {
        setSources((prev) => prev.map((s) => (s.source_id === sourceId ? { ...s, ...updated } : s)));
      }
      void refresh();
      return updated;
    },
    [sdk, refresh]
  );

  return {
    sources,
    totals,
    loading,
    error,
    refresh,
    trainFile,
    trainText,
    testApiSource,
    addApiSource,
    syncSource,
    deleteSource,
    updateSource
  };
}
