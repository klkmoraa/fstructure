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
const VERSION = 'da56a1b3c936';
const PRECACHE = ["./","./assets/CommandPalette-BGUlqnjv.js","./assets/DatasheetPanel-C8DDcvL_.css","./assets/DatasheetPanel-vvuuEoYz.js","./assets/DenseResultsSurface-C9zzOPd1.js","./assets/DesignSurface-HPAnbqLK.js","./assets/DesignSurface-geBiXXKt.css","./assets/DxfImportDialog-BFTE9GdJ.js","./assets/DxfImportDialog-avYaGg4E.css","./assets/InfluenceLineView-ZU_1_iVu.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-CHuYUqIJ.js","./assets/Model2DSurface-2thQFbEr.css","./assets/Model2DSurface-Bx9_dzlu.js","./assets/ModelDoctor-BT516Atz.css","./assets/ModelDoctor-CARNWjSH.js","./assets/NewExerciseDialog-BRRa0x21.css","./assets/NewExerciseDialog-wiJBWc6V.js","./assets/PersonalLibraryView-BfJt4zVS.css","./assets/PersonalLibraryView-CB7a7FRO.js","./assets/PortableImportCenter-CMS-KKSk.js","./assets/ResultExtremeCard-oyRo1G8x.js","./assets/RevisionComparisonPanel-C8vovkio.js","./assets/RevisionComparisonPanel-JglaFoUL.css","./assets/ShellToolSlots-D6NwK2X8.js","./assets/Space3DDefineDialogs-DYJzRzxe.js","./assets/Space3DDynamicsDialog-DORn62WD.js","./assets/Space3DSurface-2pngAq-G.css","./assets/Space3DSurface-BoLgklxP.js","./assets/StructuralBomPanel-DN7TXtSy.css","./assets/StructuralBomPanel-vfzR5zQS.js","./assets/StructureGeneratorSurface-BXdDs0Ke.js","./assets/ToolShell-C1F1FGd3.js","./assets/ToolShell-CO2WZj0X.css","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-CGITAc6j.js","./assets/WorkspaceShell-DWaStNHm.css","./assets/analysis.worker-8LTbF5kV.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-Coa3aC8H.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-Bamm5kON.js","./assets/catalogEn-ChVgdBbK.js","./assets/catalogEn-DwC3pi53.js","./assets/certificate.worker-BaDH1qwV.js","./assets/chart-no-axes-combined-BhDXt4Fk.js","./assets/chevron-left-BAVkD22o.js","./assets/circle-question-mark-BoPAFh0x.js","./assets/codec-BVJhdrY_.js","./assets/commandPalette-9X77f7Rs.css","./assets/commandPalette-DMHRPEtP.js","./assets/defaultProject-CMsMiDz2.js","./assets/designReport-CsqpWDcr.js","./assets/designWorkbenchCodec-BNdp9pDV.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-CVd7vNU3.css","./assets/diagramBands-veN-33R6.js","./assets/disclosure-B8PT-A_7.js","./assets/download-DkJ4a82X.js","./assets/editor-Bcyrff8W.js","./assets/editorLayers-1gWGRnIB.js","./assets/editorLayers-CahOhN5a.css","./assets/en-analysis-DvLdPiL9.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/frameDesign.worker-_QBcOq00.js","./assets/grid-DNaEKThz.js","./assets/index-7niWnPc_.css","./assets/index-CvshL0G8.js","./assets/influence.worker-CCviiOsE.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-pFAQNLWH.js","./assets/mesaChrome-xCMCm-TJ.css","./assets/mesaSelection-X0ujRgI2.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-DCXZmfeB.js","./assets/modelDoctorDiagnostics-CHUhZJdE.js","./assets/modelResult.worker-CAKBpXFt.js","./assets/motionFeatures-ixgA6cgC.js","./assets/overlays-CsTojQIj.js","./assets/pDelta-CpyIypVJ.js","./assets/parametric.worker-MCmlFyRX.js","./assets/pendingWrites-C6JNRrhs.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-BXR5p_kf.js","./assets/portablePayload-Cqr8Qhmh.js","./assets/projectCommand-DQD_3hq0.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/react-CGTTGAiR.js","./assets/reinforcementAlternatives.worker-CE-65f9l.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-BWBLxQaT.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-B2KecnEk.js","./assets/solver-DIP7e09o.js","./assets/space3d.worker-CQqaPqzS.js","./assets/space3dAssign-rTiAYbwI.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-Cq3tSzCp.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-BO4FYPS-.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-FVWnxNPC.js","./assets/structuralEditing-B8gQjMjD.js","./assets/structureGeneration-B3rmfThp.js","./assets/studies.worker-D-jSN4Jo.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-C25KyMpU.js","./assets/unifiedProjectSession-BkOUYRh5.js","./assets/units-C8gzfA5I.js","./assets/units-De1rkpbk.js","./assets/usePersonalLibrary-BLvgA_4M.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-BOc-WRlO.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
