/* FStructure · service worker (plantilla: `vite.config.ts` la completa al compilar y la publica como `sw.js`).
 *
 * - Sólo lee del mismo origen y nunca envía datos: guarda la app en el dispositivo.
 * - La página (index.html) se pide primero a la red, para estrenar cada versión
 *   publicada; sin red se abre la guardada.
 * - Los archivos con huella (`assets/…`) no cambian nunca: se sirven de la caché.
 * - Una versión nueva espera a que se cierre la app para tomar el control, así
 *   una pestaña abierta nunca mezcla código de dos versiones.
 */
const VERSION = '73eab83330cf';
const PRECACHE = ["./","./assets/CommandPalette-DrTJZ1Uv.js","./assets/DatasheetPanel-DDCZrPpJ.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-mBzc0n4H.js","./assets/DesignSurface-9-F67Ttx.css","./assets/DesignSurface-Dw2PRL_2.js","./assets/DxfImportDialog-B_1xjBLJ.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-C57CMrBL.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-BVc07DDc.js","./assets/Model2DSurface-CGtpzrnE.js","./assets/Model2DSurface-DyjCoPGD.css","./assets/ModelDoctor-BkpniRnU.js","./assets/ModelDoctor-CH-6YJkp.css","./assets/NewExerciseDialog-BmuTGZID.js","./assets/NewExerciseDialog-S7BBBLxe.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-BI6mE6gZ.js","./assets/PortableImportCenter-DlhclCZ0.js","./assets/ResultExtremeCard-CdH4uIP5.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/RevisionComparisonPanel-irNxOmNB.js","./assets/SectionBuilder-kMyAAjye.js","./assets/ShellToolSlots-DjvEJozm.js","./assets/Space3DDefineDialogs-TxRGsYJE.js","./assets/Space3DDynamicsDialog-DK3GGeJr.js","./assets/Space3DSurface-5pXSNQJf.css","./assets/Space3DSurface-BcZYg7Ri.js","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-CreGsQHY.js","./assets/StructureGeneratorSurface-BKU-NA8-.js","./assets/ToolShell-BssWy-9j.css","./assets/ToolShell-Xk5BQkYY.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-CKJh8O-n.js","./assets/WorkspaceShell-GJSTjiN8.css","./assets/analysis.worker-beLaJjLs.js","./assets/appVersion-CkWiFJON.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-C77znBa3.js","./assets/catalogEn-BUmu2rbM.js","./assets/catalogEn-De1A6AuZ.js","./assets/certificate.worker-DMdU7CgY.js","./assets/check-BjfGI028.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-kDP8avb_.js","./assets/commandPalette-CHjSKLwV.js","./assets/commandPalette-DQx9Afa5.css","./assets/controls-DDGNLH5c.js","./assets/defaultProject-DgotYu1Q.js","./assets/designReport-C403App9.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-1ZAwUDb7.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-DN_MVy_6.js","./assets/download-DkJ4a82X.js","./assets/editor-DhvWiRfx.js","./assets/editorLayers-BRHTX5D-.js","./assets/editorLayers-C8I4PKge.css","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/grid-CMcgDHRy.js","./assets/index-B3uhcIIh.js","./assets/index-BhzoIWg0.css","./assets/influence.worker-C85oJL11.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/mesaChrome-BYlnm4Sq.js","./assets/mesaChrome-Bew31mBN.css","./assets/mesaSelection-CCmy7scr.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-CgCJSyGV.js","./assets/modelDoctorDiagnostics-BzxHFURr.js","./assets/motionFeatures-DIpTA9jO.js","./assets/overlays-zzfLJzFG.js","./assets/pDelta-BZL15xd_.js","./assets/parametric.worker-CJC23J5k.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-Cu9lH1NM.js","./assets/portablePayload-D4n1-jlO.js","./assets/projectCommand-qnGvnJd_.js","./assets/projectSignature-Bj8f1QAV.js","./assets/react-9ZasmZpi.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/scenarios.worker-DgM3eQcU.js","./assets/sectionGeometry-JD0WF4HJ.js","./assets/shield-check-CvxkErC7.js","./assets/sliders-horizontal-BbQGX4oF.js","./assets/solver-MmcGcjXA.js","./assets/space3d.worker-Ci5JlLHx.js","./assets/space3dAssign-DghRXUm7.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-DPKVmRL5.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BXli00Lo.js","./assets/standardSections-B0piPV-d.js","./assets/storage-fkxMPhFc.js","./assets/structural-UqrEznOs.js","./assets/structuralBom-CpIKjXis.js","./assets/structuralEditing-DmDxKGZZ.js","./assets/structureGeneration-BEco54K1.js","./assets/studies.worker-B1_mpFqY.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-Cfxpw4hu.js","./assets/triangle-alert-CHGz8kUJ.js","./assets/unifiedProjectSession-DAfYd-V0.js","./assets/units-Bu9sDGHU.js","./assets/units-DNylVOSp.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-BU9zR9v8.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
const CACHE = `fstructure-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('fstructure-') && key !== CACHE).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

const sameOrigin = (url) => url.origin === self.location.origin;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!sameOrigin(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put('./', copy));
      }
      return response;
    }).catch(() => caches.match('./', { cacheName: CACHE }).then((cached) => cached ?? Response.error())));
    return;
  }

  if (url.pathname.includes('/assets/')) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })));
    return;
  }

  // Íconos y manifiestos: lo guardado al instante y la red lo renueva por detrás.
  event.respondWith(caches.open(CACHE).then((cache) => cache.match(request).then((cached) => {
    const network = fetch(request).then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    }).catch(() => cached ?? Response.error());
    return cached ?? network;
  })));
});
