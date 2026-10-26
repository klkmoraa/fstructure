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
const VERSION = '1b55ce0b5a2a';
const PRECACHE = ["./","./assets/CommandPalette-DX8HNqXO.js","./assets/DatasheetPanel-C8DDcvL_.css","./assets/DatasheetPanel-Dj1PMIYn.js","./assets/DenseResultsSurface-BobfbPmd.js","./assets/DesignSurface-BuLnKaGQ.js","./assets/DesignSurface-DwTLy40K.css","./assets/DxfImportDialog-5Yi6Qrbg.js","./assets/DxfImportDialog-avYaGg4E.css","./assets/InfluenceLineView-BucZV-ce.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-VaeK2PfW.js","./assets/Model2DSurface-CmGiMClt.css","./assets/Model2DSurface-DhKNlv2O.js","./assets/ModelDoctor-BT516Atz.css","./assets/ModelDoctor-PgkeJQ_3.js","./assets/NewExerciseDialog-BRRa0x21.css","./assets/NewExerciseDialog-J21fuiRW.js","./assets/PersonalLibraryView-BfJt4zVS.css","./assets/PersonalLibraryView-CJNQ1iDd.js","./assets/PortableImportCenter-Brlr5e_h.js","./assets/ResultExtremeCard-B4492Xcv.js","./assets/RevisionComparisonPanel-DYp1N8Gk.js","./assets/RevisionComparisonPanel-JglaFoUL.css","./assets/ShellToolSlots-BJv9PSMU.js","./assets/Space3DDefineDialogs-CxIcw-Uf.js","./assets/Space3DDynamicsDialog-QhgkDR5l.js","./assets/Space3DSurface-BXSaT2ph.js","./assets/Space3DSurface-C8efnqrp.css","./assets/StructuralBomPanel-DBrHj5te.js","./assets/StructuralBomPanel-DN7TXtSy.css","./assets/StructureGeneratorSurface-BlQaLFvQ.js","./assets/ToolShell-C4ASdjt8.js","./assets/ToolShell-Y1Z06fvU.css","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-jSpLA0wH.js","./assets/WorkspaceShell-tO0B0HCp.css","./assets/analysis.worker-8LTbF5kV.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-Coa3aC8H.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-BVx6OWr8.js","./assets/catalogEn-CU6Dh-pb.js","./assets/catalogEn-HfOxidB3.js","./assets/certificate.worker-BaDH1qwV.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-BVJhdrY_.js","./assets/commandPalette-9X77f7Rs.css","./assets/commandPalette-HW15dySY.js","./assets/defaultProject-CMsMiDz2.js","./assets/designReport-DyIwfV3o.js","./assets/designWorkbenchCodec-BNdp9pDV.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-CVd7vNU3.css","./assets/diagramBands-Czv_o-Va.js","./assets/disclosure-BSXV3A0q.js","./assets/download-DkJ4a82X.js","./assets/editor-BQkFnhhl.js","./assets/editorLayers-CahOhN5a.css","./assets/editorLayers-DQ8g_luU.js","./assets/en-analysis-DvLdPiL9.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/frameDesign.worker-_QBcOq00.js","./assets/grid-DNaEKThz.js","./assets/index-BOg3gcmj.js","./assets/index-BRN1dKSH.css","./assets/influence.worker-CCviiOsE.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-BylDsIhB.css","./assets/mesaChrome-C987J3vp.js","./assets/mesaSelection-BhLAH3lr.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-DCXZmfeB.js","./assets/modelDoctorDiagnostics-BXJVj0D-.js","./assets/modelResult.worker-CAKBpXFt.js","./assets/motionFeatures-B9Ev7Nt_.js","./assets/overlays-bw77nqlz.js","./assets/pDelta-BU0EFOja.js","./assets/parametric.worker-MCmlFyRX.js","./assets/pendingWrites-C6JNRrhs.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-BXR5p_kf.js","./assets/portablePayload-CMBsD0Io.js","./assets/projectCommand-Ck4mW-1t.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/react-CGTTGAiR.js","./assets/reinforcementAlternatives.worker-CE-65f9l.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-BWBLxQaT.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/solver-CcV3lYSZ.js","./assets/space3d.worker-CQqaPqzS.js","./assets/space3dAssign-rTiAYbwI.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-Cq3tSzCp.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-BO4FYPS-.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-CueFU38h.js","./assets/structuralEditing-DZHjUBY_.js","./assets/structureGeneration-BQ_AQcQ4.js","./assets/studies.worker-D-jSN4Jo.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-Co1ZJsL8.js","./assets/unifiedProjectSession-DiI9LAlQ.js","./assets/units-C8gzfA5I.js","./assets/units-De1rkpbk.js","./assets/usePersonalLibrary-BLvgA_4M.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-COfuSEZN.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
