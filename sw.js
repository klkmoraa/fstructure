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
const VERSION = '55f9f1716f2c';
const PRECACHE = ["./","./assets/CommandPalette-C1-J5wmd.js","./assets/DatasheetPanel-DR-Vtyj1.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-CdVJz2BA.js","./assets/DesignSurface-C8ZzwVk7.css","./assets/DesignSurface-Domqz5QP.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/DxfImportDialog-DsYr9Lxq.js","./assets/InfluenceLineView-CPHErZQA.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-DxgqyaOQ.js","./assets/Model2DSurface-CZrnBEDr.css","./assets/Model2DSurface-DycdWeHb.js","./assets/ModelDoctor-CH-6YJkp.css","./assets/ModelDoctor-CjxddJVe.js","./assets/NewExerciseDialog-D6R8G-WF.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-CqrQCE5l.js","./assets/PortableImportCenter-DNmYeVyJ.js","./assets/ResultExtremeCard-CEUXhk0q.js","./assets/RevisionComparisonPanel-BS5nrAxp.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/ShellToolSlots-DnSrroUG.js","./assets/Space3DDefineDialogs-yKEnGUks.js","./assets/Space3DDynamicsDialog-CLX2NDsQ.js","./assets/Space3DSurface-90lsEK5e.js","./assets/Space3DSurface-D9UVd3f0.css","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-C3TTBA8n.js","./assets/StructureGeneratorSurface-CQNxc4x6.js","./assets/ToolShell-BB0E4su0.css","./assets/ToolShell-DeGPwH0W.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-B4e-HrP-.css","./assets/WorkspaceShell-LN7L7tZP.js","./assets/analysis.worker-8LTbF5kV.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-Coa3aC8H.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-CD4jWcXt.js","./assets/catalogEn-B6Jub3Xm.js","./assets/catalogEn-HfOxidB3.js","./assets/certificate.worker-BaDH1qwV.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-BVJhdrY_.js","./assets/commandPalette-C_lNLXGP.js","./assets/commandPalette-DQx9Afa5.css","./assets/defaultProject-CMsMiDz2.js","./assets/designReport-89nIkQY_.js","./assets/designWorkbenchCodec-BNdp9pDV.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-CSBKKUVR.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-DqlOrTTf.js","./assets/download-DkJ4a82X.js","./assets/editor-NghaJlV3.js","./assets/editorLayers-CahOhN5a.css","./assets/editorLayers-CqVnqfBG.js","./assets/en-analysis-DvLdPiL9.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/frameDesign.worker-_QBcOq00.js","./assets/grid-DNaEKThz.js","./assets/index-BVJX_j6e.js","./assets/index-Tr4SOoYE.css","./assets/influence.worker-CCviiOsE.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-B5LoTf-l.js","./assets/mesaChrome-CbmpXQJC.css","./assets/mesaSelection-HyfKQgtd.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-DCXZmfeB.js","./assets/modelDoctorDiagnostics-Bk_1dVLq.js","./assets/modelResult.worker-CAKBpXFt.js","./assets/motionFeatures-lw4_qSvC.js","./assets/overlays-B-uTqOaH.js","./assets/pDelta-BXyvJU-D.js","./assets/parametric.worker-MCmlFyRX.js","./assets/pendingWrites-C6JNRrhs.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-BXR5p_kf.js","./assets/portablePayload-CKz7TQTx.js","./assets/projectCommand-C5WGqjzi.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/react-CGTTGAiR.js","./assets/reinforcementAlternatives.worker-CE-65f9l.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-BWBLxQaT.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/solver-CcrEUULA.js","./assets/space3d.worker-CQqaPqzS.js","./assets/space3dAssign-rTiAYbwI.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-Cq3tSzCp.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-BO4FYPS-.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-CQdhwWNp.js","./assets/structuralEditing-D_arkDHq.js","./assets/structureGeneration-BWs2z5Qc.js","./assets/studies.worker-D-jSN4Jo.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-C4Oe2Nsx.js","./assets/unifiedProjectSession-DR318FlT.js","./assets/units-C8gzfA5I.js","./assets/units-De1rkpbk.js","./assets/usePersonalLibrary-BLvgA_4M.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-B-H8rCmX.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
