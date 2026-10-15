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
const VERSION = '03ece63ca5cf';
const PRECACHE = ["./","./assets/CommandPalette-CXo8u-WU.js","./assets/DatasheetPanel-BMhz9lfT.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-lp2Vxsk0.js","./assets/DesignSurface-8zgKgvxu.js","./assets/DesignSurface-D9ejDwm2.css","./assets/DxfImportDialog-DYJrNAeF.css","./assets/DxfImportDialog-DnjcqFMl.js","./assets/InfluenceLineView-DhCuhMjU.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-CuBaaGWg.js","./assets/Model2DSurface--ZeYdeOa.js","./assets/Model2DSurface-CM-lQGtI.css","./assets/ModelDoctor-BeZdx0Ti.js","./assets/ModelDoctor-CH-6YJkp.css","./assets/NewExerciseDialog-NWvwVR5T.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-C0e7o7Ky.js","./assets/PortableImportCenter-CXAzOQGP.js","./assets/ResultExtremeCard-Csf7tHdb.js","./assets/RevisionComparisonPanel-BVYEwIem.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/ShellToolSlots-CQRuJ0zm.js","./assets/Space3DDefineDialogs-D5FsG6Rt.js","./assets/Space3DDynamicsDialog-DUKv7-us.js","./assets/Space3DSurface-CblEUgTb.js","./assets/Space3DSurface-D9UVd3f0.css","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-DlgExTeH.js","./assets/StructureGeneratorSurface-D-62FQnK.js","./assets/ToolShell-BB0E4su0.css","./assets/ToolShell-DcDtQDTl.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-DAyc0U0-.js","./assets/WorkspaceShell-DLD35cZz.css","./assets/analysis.worker-B2FAc8ft.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-BhRzFoon.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-CCTod9Zx.js","./assets/catalogEn-D6Fb5Lpf.js","./assets/catalogEn-ORg0gwW3.js","./assets/certificate.worker-DtMmOleM.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-BVJhdrY_.js","./assets/commandPalette-DQx9Afa5.css","./assets/commandPalette-YUS0atOT.js","./assets/defaultProject-DgVyu8JU.js","./assets/designReport-DrejBy-M.js","./assets/designWorkbenchCodec-BNdp9pDV.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-CNb2053s.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-Bb6JRO0v.js","./assets/download-DkJ4a82X.js","./assets/editor-C_oMnZWe.js","./assets/editorLayers-wNbBx5-r.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/grid-DNaEKThz.js","./assets/index-DEKo1bQk.js","./assets/index-J62Mhu7-.css","./assets/influence.worker-fQgTOG-K.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-CPBzxkxv.js","./assets/mesaChrome-C_htGbWX.css","./assets/mesaSelection-F9Vn3yy1.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-BdLbRMPF.js","./assets/modelDoctorDiagnostics-DZnVj8R6.js","./assets/modelResult.worker-BWjNysfs.js","./assets/motionFeatures-DrVj_ejo.js","./assets/overlays-B--PwnEr.js","./assets/pDelta-Cvi3zTAJ.js","./assets/parametric.worker-vW6zyirt.js","./assets/pendingWrites-C6JNRrhs.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-BXR5p_kf.js","./assets/portablePayload-Cwhq-Nmh.js","./assets/projectCommand-CAJgtror.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/react-CGTTGAiR.js","./assets/reinforcementAlternatives.worker-CqIbKHMO.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-LOsj-tPm.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/solver-B2RNAfhN.js","./assets/space3d.worker-CQqaPqzS.js","./assets/space3dAssign-rTiAYbwI.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-BLuJZNdK.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-BO4FYPS-.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-BVe0NRxe.js","./assets/structuralEditing-DCMWxAPl.js","./assets/structureGeneration-B7MiaCaf.js","./assets/studies.worker-0HuPKxYN.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-CF4IR39e.js","./assets/unifiedProjectSession-BWseTeW5.js","./assets/units-C8gzfA5I.js","./assets/units-De1rkpbk.js","./assets/usePersonalLibrary-BLvgA_4M.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-CkGlcMMd.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
