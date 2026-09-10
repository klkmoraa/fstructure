import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../data/defaultProject';
import { unavailableAnalysis } from '../engine/analysisFailure';
import { IndexedDbProjectRepository, InMemoryProjectRepository, type AnalysisRunRecord } from './projectRepository';

type Handler = ((event: Event) => void) | null;

class FakeRequest<T> {
  result: T | undefined;
  error: DOMException | null = null;
  onsuccess: Handler = null;
  onerror: Handler = null;

  resolve(result: T) {
    this.result = result;
    queueMicrotask(() => this.onsuccess?.({} as Event));
  }

  reject(error: unknown) {
    this.error = error instanceof DOMException ? error : new DOMException(String(error), 'OperationError');
    queueMicrotask(() => this.onerror?.({} as Event));
  }
}

type FakeRecords = Map<IDBValidKey, unknown>;
interface FakeDatabaseState { version: number; stores: Map<string, FakeRecords> }

class FakeTransaction {
  oncomplete: Handler = null;
  onabort: Handler = null;
  onerror: Handler = null;
  private pending = 0;
  private completionScheduled = false;
  private readonly state: FakeDatabaseState;
  private readonly names: string[];

  constructor(state: FakeDatabaseState, names: string[]) {
    this.state = state;
    this.names = names;
  }

  objectStore(name: string) {
    if (!this.names.includes(name)) throw new Error(`Store fuera de la transacción: ${name}`);
    const records = this.state.stores.get(name);
    if (!records) throw new Error(`Store ausente: ${name}`);
    return new FakeObjectStore(this, records);
  }

  request<T>(operation: () => T): FakeRequest<T> {
    const request = new FakeRequest<T>();
    this.pending += 1;
    setTimeout(() => {
      try { request.resolve(operation()); }
      catch (error) { request.reject(error); this.onerror?.({} as Event); }
      finally { this.pending -= 1; this.scheduleCompletion(); }
    }, 0);
    return request;
  }

  private scheduleCompletion() {
    if (this.pending || this.completionScheduled) return;
    this.completionScheduled = true;
    setTimeout(() => {
      if (this.pending) { this.completionScheduled = false; return; }
      this.oncomplete?.({} as Event);
    }, 0);
  }
}

class FakeObjectStore {
  private readonly transaction: FakeTransaction;
  private readonly records: FakeRecords;

  constructor(transaction: FakeTransaction, records: FakeRecords) {
    this.transaction = transaction;
    this.records = records;
  }

  get(key: IDBValidKey) { return this.transaction.request(() => this.clone(this.records.get(key))); }
  getAll() { return this.transaction.request(() => [...this.records.values()].map((value) => structuredClone(value))); }
  put(value: unknown) {
    return this.transaction.request(() => {
      const key = this.key(value);
      this.records.set(key, structuredClone(value));
      return key;
    });
  }
  add(value: unknown) {
    return this.transaction.request(() => {
      const key = this.key(value);
      if (this.records.has(key)) throw new DOMException('Duplicate key', 'ConstraintError');
      this.records.set(key, structuredClone(value));
      return key;
    });
  }
  delete(key: IDBValidKey) { return this.transaction.request(() => { this.records.delete(key); return undefined; }); }

  private key(value: unknown): IDBValidKey {
    if (!value || typeof value !== 'object') throw new Error('Registro inválido.');
    const candidate = value as { id?: IDBValidKey; key?: IDBValidKey };
    const key = candidate.id ?? candidate.key;
    if (key === undefined) throw new Error('Registro sin clave.');
    return key;
  }

  private clone<T>(value: T | undefined): T | undefined {
    return value === undefined ? undefined : structuredClone(value);
  }
}

class FakeDatabase {
  readonly objectStoreNames = { contains: (name: string) => this.state.stores.has(name) } as unknown as DOMStringList;
  private readonly state: FakeDatabaseState;

  constructor(state: FakeDatabaseState) {
    this.state = state;
  }

  createObjectStore(name: string) {
    this.state.stores.set(name, new Map());
    return {} as IDBObjectStore;
  }

  transaction(names: string | string[]) {
    return new FakeTransaction(this.state, typeof names === 'string' ? [names] : names) as unknown as IDBTransaction;
  }
}

class FakeIndexedDbFactory {
  private readonly databases = new Map<string, FakeDatabaseState>();

  seedVersionOne(name: string, projectId: string) {
    this.databases.set(name, {
      version: 1,
      stores: new Map([
        ['projects', new Map([[projectId, { id: projectId }]])],
        ['recoveries', new Map()],
        ['meta', new Map()],
      ]),
    });
  }

  open(name: string, requestedVersion = 1) {
    const request = new FakeRequest<FakeDatabase>() as FakeRequest<FakeDatabase> & { onupgradeneeded: Handler };
    request.onupgradeneeded = null;
    setTimeout(() => {
      const state = this.databases.get(name) ?? { version: 0, stores: new Map<string, FakeRecords>() };
      this.databases.set(name, state);
      const database = new FakeDatabase(state);
      if (requestedVersion > state.version) {
        state.version = requestedVersion;
        request.result = database;
        request.onupgradeneeded?.({} as Event);
      }
      request.resolve(database);
    }, 0);
    return request as unknown as IDBOpenDBRequest;
  }
}

const runRecord = (projectId: string, id: string, label: string, createdAt: string): AnalysisRunRecord => {
  const project = createBlankProject();
  project.id = projectId;
  return {
    id,
    projectId,
    label,
    createdAt,
    snapshot: {
      schemaVersion: 1,
      kind: 'fusionstructure-revision-snapshot',
      revisionId: `sha256:${id}`,
      capturedAt: createdAt,
      project,
      analysis: {
        result: unavailableAnalysis('fixture'),
        projectSignature: `signature:${id}`,
        resultDigest: `sha256:result:${id}`,
        scenarioId: 'case:LC1',
      },
    },
  };
};

describe('analysis runs in ProjectRepository', () => {
  it('stores isolated runs newest first and returns defensive copies', async () => {
    const repository = new InMemoryProjectRepository();
    const older = runRecord('project-a', 'run-old', 'Base', '2026-09-08T10:00:00.000Z');
    const newer = runRecord('project-a', 'run-new', 'Alternativa', '2026-09-09T10:00:00.000Z');
    const otherProject = runRecord('project-b', 'run-other', 'Otro proyecto', '2026-09-09T11:00:00.000Z');

    await repository.saveAnalysisRun(older);
    await repository.saveAnalysisRun(newer);
    await repository.saveAnalysisRun(otherProject);

    const runs = await repository.listAnalysisRuns('project-a');
    expect(runs.map((run) => run.id)).toEqual(['run-new', 'run-old']);
    runs[0].snapshot.project.name = 'mutated outside repository';

    const reread = await repository.listAnalysisRuns('project-a');
    expect(reread[0].snapshot.project.name).not.toBe('mutated outside repository');
    expect(await repository.listAnalysisRuns('project-b')).toHaveLength(1);
  });

  it('deletes one run without affecting the other project or run', async () => {
    const repository = new InMemoryProjectRepository();
    await repository.saveAnalysisRun(runRecord('project-a', 'run-a', 'A', '2026-09-09T10:00:00.000Z'));
    await repository.saveAnalysisRun(runRecord('project-b', 'run-b', 'B', '2026-09-09T11:00:00.000Z'));

    await repository.deleteAnalysisRun('run-a');

    expect(await repository.listAnalysisRuns('project-a')).toEqual([]);
    expect((await repository.listAnalysisRuns('project-b')).map((run) => run.id)).toEqual(['run-b']);
  });

  it('rejects a mismatched snapshot project and duplicate ids', async () => {
    const repository = new InMemoryProjectRepository();
    const record = runRecord('project-a', 'run-a', 'A', '2026-09-09T10:00:00.000Z');

    await expect(repository.saveAnalysisRun({ ...record, projectId: 'project-b' })).rejects.toThrow(/no coincide/i);
    await repository.saveAnalysisRun(record);
    await expect(repository.saveAnalysisRun(record)).rejects.toThrow(/inmutable/i);
    await expect(repository.saveAnalysisRun({ ...record, id: 'run-b', label: '   ' })).rejects.toThrow(/nombre/i);
  });

  it('migrates the IndexedDB store, persists across repository instances, and cascades on project deletion', async () => {
    const factory = new FakeIndexedDbFactory();
    factory.seedVersionOne('structureCo.projects', 'project-a');
    const repository = new IndexedDbProjectRepository(factory as unknown as IDBFactory);
    const record = runRecord('project-a', 'run-a', 'A', '2026-09-09T10:00:00.000Z');

    await repository.saveAnalysisRun(record);
    const reopened = new IndexedDbProjectRepository(factory as unknown as IDBFactory);
    expect((await reopened.listAnalysisRuns('project-a')).map((run) => run.label)).toEqual(['A']);

    await reopened.deleteProject('project-a');
    expect(await repository.listAnalysisRuns('project-a')).toEqual([]);
  });
});
