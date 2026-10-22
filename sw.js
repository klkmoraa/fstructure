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
const VERSION = '332edb71fd27';
const PRECACHE = ["./","./assets/CommandPalette-B723G0AT.js","./assets/DatasheetPanel-07nYcf2Z.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-CPtBbwFd.js","./assets/DesignSurface-C8ZzwVk7.css","./assets/DesignSurface-D4alcpGT.js","./assets/DxfImportDialog-Bn0pqvFU.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-BgE3X5Wu.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-CJFhLzhO.js","./assets/Model2DSurface-CZrnBEDr.css","./assets/Model2DSurface-rolkCDEw.js","./assets/ModelDoctor-CH-6YJkp.css","./assets/ModelDoctor-DTudCuMt.js","./assets/NewExerciseDialog-BqURyR94.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-D4skLS0D.js","./assets/PortableImportCenter-DS5GV85I.js","./assets/ResultExtremeCard-BMWlk-N7.js","./assets/RevisionComparisonPanel-BLEYw3by.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/ShellToolSlots-DzpAivqJ.js","./assets/Space3DDefineDialogs-D40oqZ4G.js","./assets/Space3DDynamicsDialog-mV8pLZN7.js","./assets/Space3DSurface-D9UVd3f0.css","./assets/Space3DSurface-ZUotYA4a.js","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-D9lGzcLz.js","./assets/StructureGeneratorSurface-B9dO_Hia.js","./assets/ToolShell-BB0E4su0.css","./assets/ToolShell-ChsU8m-l.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-8ItmMjXM.css","./assets/WorkspaceShell-Dyg4hADr.js","./assets/analysis.worker-B0TSIoqM.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-JkO16CPU.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-DIB8hOdG.js","./assets/catalogEn-CZazdn-Q.js","./assets/catalogEn-D6Fb5Lpf.js","./assets/certificate.worker-BtgwxRd6.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-BVJhdrY_.js","./assets/commandPalette-DQx9Afa5.css","./assets/commandPalette-DUq84LVj.js","./assets/defaultProject-CMsMiDz2.js","./assets/designReport-DL9x-IqQ.js","./assets/designWorkbenchCodec-BNdp9pDV.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-Qr_nULkX.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-Du5Y3BEi.js","./assets/download-DkJ4a82X.js","./assets/editor-BaM3WV1w.js","./assets/editorLayers-BOtRXNC3.js","./assets/editorLayers-CahOhN5a.css","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/frameDesign.worker-CiwTNLV9.js","./assets/grid-DNaEKThz.js","./assets/index-Tr4SOoYE.css","./assets/index-cZgOeoUa.js","./assets/influence.worker-D7sFblhy.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-BfjRMbQE.js","./assets/mesaChrome-DiK8GWwB.css","./assets/mesaSelection-UydC0oNp.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-nxbkj1Ic.js","./assets/modelDoctorDiagnostics-OEZLXY80.js","./assets/modelResult.worker-BoZ6VpnL.js","./assets/motionFeatures-DjRPllcc.js","./assets/overlays-DZZ1DQaz.js","./assets/pDelta-Ck4MNhUn.js","./assets/parametric.worker-EH9FBcEC.js","./assets/pendingWrites-C6JNRrhs.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-BXR5p_kf.js","./assets/portablePayload-CtdMF4dT.js","./assets/projectCommand-BzV9VFVB.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/react-CGTTGAiR.js","./assets/reinforcementAlternatives.worker-Bb4Z1e0n.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-CKCE2mVk.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/solver-CI9wCZt6.js","./assets/space3d.worker-CQqaPqzS.js","./assets/space3dAssign-rTiAYbwI.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-D0Got6np.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-BO4FYPS-.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-BOGOxe6h.js","./assets/structuralEditing-CoNqVEaz.js","./assets/structureGeneration-BiQG_IIv.js","./assets/studies.worker-DdmX6Q9g.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-RQUT5YKY.js","./assets/unifiedProjectSession-nkJ_Pgfq.js","./assets/units-C8gzfA5I.js","./assets/units-De1rkpbk.js","./assets/usePersonalLibrary-BLvgA_4M.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-DvtyFSlP.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
