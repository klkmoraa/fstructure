/**
 * Conexión IndexedDB cacheada que nunca se queda con un fallo ni bloquea a otra
 * pestaña:
 *
 * - Una apertura rechazada o bloqueada no se guarda: la siguiente llamada abre
 *   de nuevo (antes `onblocked` dejaba la biblioteca rechazada hasta recargar).
 * - `blocked` (otra pestaña conserva la versión anterior abierta) rechaza ya,
 *   con un mensaje claro; si esa apertura termina después, la conexión tardía
 *   se cierra para no retener la base.
 * - `versionchange` (otra pestaña abre una versión nueva o borra la base) y
 *   `close` (el navegador la cerró) cierran esta conexión y la olvidan.
 */
export class CachedDatabase {
  private connection: Promise<IDBDatabase> | null = null;
  private readonly factory: IDBFactory;
  private readonly name: string;
  private readonly version: number;
  private readonly upgrade: (database: IDBDatabase) => void;
  private readonly messages: { failed: string; blocked: string };

  constructor(factory: IDBFactory, name: string, version: number, upgrade: (database: IDBDatabase) => void, messages: { failed: string; blocked: string }) {
    this.factory = factory;
    this.name = name;
    this.version = version;
    this.upgrade = upgrade;
    this.messages = messages;
  }

  open(): Promise<IDBDatabase> {
    if (this.connection) return this.connection;
    let settled = false;
    const forget = () => { if (this.connection === opening) this.connection = null; };
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const request = this.factory.open(this.name, this.version);
      request.onupgradeneeded = () => this.upgrade(request.result);
      request.onerror = () => fail(request.error ?? new Error(this.messages.failed));
      request.onblocked = () => fail(new Error(this.messages.blocked));
      request.onsuccess = () => {
        const database = request.result;
        if (settled) { database.close(); return; }
        settled = true;
        database.onversionchange = () => { database.close(); forget(); };
        database.onclose = forget;
        resolve(database);
      };
    });
    this.connection = opening;
    // También si `open` lanzó al instante: un rechazo nunca queda cacheado.
    opening.catch(forget);
    return opening;
  }
}
