/* FStructure · service worker (plantilla: `vite.config.ts` la completa al compilar y la publica como `sw.js`).
 *
 * - Sólo lee del mismo origen y nunca envía datos: guarda la app en el dispositivo.
 * - La página (index.html) se pide primero a la red, para estrenar cada versión
 *   publicada; sin red se abre la guardada.
 * - Los archivos con huella (`assets/…`) no cambian nunca: se sirven de la caché.
 * - Una versión nueva espera a que se cierre la app para tomar el control, así
 *   una pestaña abierta nunca mezcla código de dos versiones. La app avisa
 *   «Nueva versión lista» y, si la persona pulsa «Recargar», manda
 *   `SKIP_WAITING`: sólo entonces la versión nueva toma el control.
 */
const VERSION = '55ef8ad4de1f';
const PRECACHE = ["./","./assets/CommandPalette-D1bmpvGy.js","./assets/DatasheetPanel-C8DDcvL_.css","./assets/DatasheetPanel-CYxGKmod.js","./assets/DenseResultsSurface-GKRY7AEK.js","./assets/DesignSurface-CGTviwM9.js","./assets/DesignSurface-geBiXXKt.css","./assets/DxfImportDialog-KgANV2_y.js","./assets/DxfImportDialog-avYaGg4E.css","./assets/InfluenceLineView-BUpCDYGC.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-Cj26yGjc.js","./assets/Model2DSurface-2thQFbEr.css","./assets/Model2DSurface-BR6BTxUh.js","./assets/ModelDoctor-BT516Atz.css","./assets/ModelDoctor-CwRhB0QW.js","./assets/NewExerciseDialog-B2fVOLiV.js","./assets/NewExerciseDialog-BRRa0x21.css","./assets/PersonalLibraryView-BMU8F_Gi.js","./assets/PersonalLibraryView-BfJt4zVS.css","./assets/PortableImportCenter-BUDqoBtl.js","./assets/ResultExtremeCard-Ce-15CbH.js","./assets/RevisionComparisonPanel-7dW2SqLS.js","./assets/RevisionComparisonPanel-JglaFoUL.css","./assets/ShellToolSlots-D3iSBz9B.js","./assets/Space3DDefineDialogs-B4XAC_Ai.js","./assets/Space3DDynamicsDialog-D-Wt-38B.js","./assets/Space3DSurface-2pngAq-G.css","./assets/Space3DSurface-Ba1vlxim.js","./assets/StructuralBomPanel-D5Rous5x.js","./assets/StructuralBomPanel-DN7TXtSy.css","./assets/StructureGeneratorSurface-qqjf83Ck.js","./assets/ToolShell-CO2WZj0X.css","./assets/ToolShell-D32LvNMj.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-goFd0b-2.css","./assets/WorkspaceShell-iIePvV8o.js","./assets/analysis.worker-8LTbF5kV.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-Coa3aC8H.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-B9Z0RJ77.js","./assets/catalogEn-ChVgdBbK.js","./assets/catalogEn-DwC3pi53.js","./assets/certificate.worker-BaDH1qwV.js","./assets/chart-no-axes-combined-BhDXt4Fk.js","./assets/chevron-left-BAVkD22o.js","./assets/circle-question-mark-BoPAFh0x.js","./assets/codec-BVJhdrY_.js","./assets/commandPalette-9X77f7Rs.css","./assets/commandPalette-CNkpzUBS.js","./assets/defaultProject-CMsMiDz2.js","./assets/designReport-BytgD-4e.js","./assets/designWorkbenchCodec-BNdp9pDV.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-CVd7vNU3.css","./assets/diagramBands-DG6PjWob.js","./assets/disclosure-0EWKnkj0.js","./assets/download-DkJ4a82X.js","./assets/editor-BQhGG4a4.js","./assets/editorLayers-CahOhN5a.css","./assets/editorLayers-gUdH-gh3.js","./assets/en-analysis-DvLdPiL9.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/frameDesign.worker-_QBcOq00.js","./assets/grid-DNaEKThz.js","./assets/index-6WVOOssZ.css","./assets/index-DizOWT32.js","./assets/influence.worker-CCviiOsE.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-CrkDMq0u.js","./assets/mesaChrome-xCMCm-TJ.css","./assets/mesaSelection-DtjesJ2c.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-DCXZmfeB.js","./assets/modelDoctorDiagnostics-D_7FNVL2.js","./assets/modelResult.worker-CAKBpXFt.js","./assets/motionFeatures-rrIoDwns.js","./assets/overlays-D3casLWp.js","./assets/pDelta-DajYTGgt.js","./assets/parametric.worker-MCmlFyRX.js","./assets/pendingWrites-C6JNRrhs.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-BXR5p_kf.js","./assets/portablePayload-C56P0l8I.js","./assets/projectCommand-mEgE9ibP.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/react-CGTTGAiR.js","./assets/reinforcementAlternatives.worker-CE-65f9l.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-BWBLxQaT.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-B2KecnEk.js","./assets/solver-BnYRd9Nq.js","./assets/space3d.worker-CQqaPqzS.js","./assets/space3dAssign-rTiAYbwI.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-Cq3tSzCp.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-BO4FYPS-.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-DYESCuZO.js","./assets/structuralEditing-XPmZAUi6.js","./assets/structureGeneration-CAVzRGCX.js","./assets/studies.worker-D-jSN4Jo.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-Dc5pOdEl.js","./assets/unifiedProjectSession-Eqi_XaYP.js","./assets/units-C8gzfA5I.js","./assets/units-De1rkpbk.js","./assets/usePersonalLibrary-BLvgA_4M.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-7F7GaMnN.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
const CACHE = `fstructure-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
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
