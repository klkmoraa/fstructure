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
const VERSION = '0a9f31c00284';
const PRECACHE = ["./","./assets/CommandPalette-DP7UH8MB.js","./assets/DatasheetPanel-BPL6x2P3.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-DEfKDDKD.js","./assets/DesignSurface-C3mxs8y3.js","./assets/DesignSurface-D9ejDwm2.css","./assets/DxfImportDialog-CsuxyqWu.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-B_mstRzl.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-DHNceqcJ.js","./assets/Model2DSurface-Bu7UUA5A.js","./assets/Model2DSurface-CM-lQGtI.css","./assets/ModelDoctor-BbXUO4Ko.js","./assets/ModelDoctor-CH-6YJkp.css","./assets/NewExerciseDialog-GvbfXto_.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-DAycidZQ.js","./assets/PortableImportCenter-BLQLWDT5.js","./assets/ResultExtremeCard-C1RrLAnD.js","./assets/RevisionComparisonPanel-CZUEWo_0.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/ShellToolSlots-Zy0MG26f.js","./assets/Space3DDefineDialogs-QwnYLOhm.js","./assets/Space3DDynamicsDialog-DMpAudt0.js","./assets/Space3DSurface-CJtudHJ4.js","./assets/Space3DSurface-DR2I_LWO.css","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-CZdTJCRg.js","./assets/StructureGeneratorSurface-jc1mnUFQ.js","./assets/ToolShell-BB0E4su0.css","./assets/ToolShell-C4kh5HW7.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-DLD35cZz.css","./assets/WorkspaceShell-ph2oy1DC.js","./assets/analysis.worker-B2FAc8ft.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-BhRzFoon.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-Bw_m3WnF.js","./assets/catalogEn-D6Fb5Lpf.js","./assets/catalogEn-ORg0gwW3.js","./assets/certificate.worker-DtMmOleM.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-BVJhdrY_.js","./assets/commandPalette-9kViUwn8.js","./assets/commandPalette-DQx9Afa5.css","./assets/defaultProject-DgVyu8JU.js","./assets/designReport-C_X7NMai.js","./assets/designWorkbenchCodec-BNdp9pDV.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands--zFmFQC4.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-HnOduRt2.js","./assets/download-DkJ4a82X.js","./assets/editor-CJPtuaB-.js","./assets/editorLayers-QPhXkEaO.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/grid-DNaEKThz.js","./assets/index-J62Mhu7-.css","./assets/index-VK-6sTG3.js","./assets/influence.worker-fQgTOG-K.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-C_htGbWX.css","./assets/mesaChrome-D4_6szcn.js","./assets/mesaSelection-CYfWLref.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-BdLbRMPF.js","./assets/modelDoctorDiagnostics-DVIw9mP2.js","./assets/modelResult.worker-BWjNysfs.js","./assets/motionFeatures-CmQ8OnbB.js","./assets/overlays-C_FBTAjN.js","./assets/pDelta-BQ1_GwHv.js","./assets/parametric.worker-vW6zyirt.js","./assets/pendingWrites-C6JNRrhs.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-BXR5p_kf.js","./assets/portablePayload-BOVXt783.js","./assets/projectCommand-ZP7uUOn1.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/react-CGTTGAiR.js","./assets/reinforcementAlternatives.worker-CqIbKHMO.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-LOsj-tPm.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/solver-B12mREhw.js","./assets/space3d.worker-CQqaPqzS.js","./assets/space3dAssign-rTiAYbwI.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-BLuJZNdK.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-BO4FYPS-.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-DY-GV7XX.js","./assets/structuralEditing-B0SM0g5G.js","./assets/structureGeneration-I2pLceG3.js","./assets/studies.worker-0HuPKxYN.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-C0HPeU1g.js","./assets/unifiedProjectSession-BRC7X-hn.js","./assets/units-C8gzfA5I.js","./assets/units-De1rkpbk.js","./assets/usePersonalLibrary-BLvgA_4M.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-pD_raTpu.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
