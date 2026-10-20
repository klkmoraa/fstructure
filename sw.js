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
const VERSION = 'c62bb8751a10';
const PRECACHE = ["./","./assets/CommandPalette-CDJrur0g.js","./assets/DatasheetPanel-CKwsomyj.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-SNUhnnbA.js","./assets/DesignSurface-C8ZzwVk7.css","./assets/DesignSurface-HkeDp7OL.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/DxfImportDialog-e0AsbSnJ.js","./assets/InfluenceLineView-BKfHpyuH.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-bwQ-aFWM.js","./assets/Model2DSurface-Cc6uU2YD.css","./assets/Model2DSurface-cdn6x7rl.js","./assets/ModelDoctor-4jQHpOLE.js","./assets/ModelDoctor-CH-6YJkp.css","./assets/NewExerciseDialog-CAIQNbpT.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-C6igguIb.js","./assets/PortableImportCenter-BcSQEJI9.js","./assets/ResultExtremeCard-DTzyuH2S.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/RevisionComparisonPanel-V6v_-w4G.js","./assets/ShellToolSlots-BKQiiaUX.js","./assets/Space3DDefineDialogs-Bm5RqDhJ.js","./assets/Space3DDynamicsDialog-BCK3BAxE.js","./assets/Space3DSurface-CD6m8dIx.js","./assets/Space3DSurface-D9UVd3f0.css","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-BKYGUjtZ.js","./assets/StructureGeneratorSurface-BnyvNIpK.js","./assets/ToolShell-BB0E4su0.css","./assets/ToolShell-DGJ_s_gA.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-8ItmMjXM.css","./assets/WorkspaceShell-Dj-IrooG.js","./assets/analysis.worker-B2FAc8ft.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-r-_i7nTh.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-DJZ-mTUE.js","./assets/catalogEn-D6Fb5Lpf.js","./assets/catalogEn-uqppeeTr.js","./assets/certificate.worker-DtMmOleM.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-BVJhdrY_.js","./assets/commandPalette-DQx9Afa5.css","./assets/commandPalette-sMy5f3gy.js","./assets/defaultProject-CMsMiDz2.js","./assets/designReport-Dt8iGfco.js","./assets/designWorkbenchCodec-BNdp9pDV.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-CVfcoYJD.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-C1C3SSFG.js","./assets/download-DkJ4a82X.js","./assets/editor-VyB_Z4Nx.js","./assets/editorLayers-BXfCbOXo.css","./assets/editorLayers-XmEZhwGg.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/frameDesign.worker-CqvptTnd.js","./assets/grid-DNaEKThz.js","./assets/index-1XVgXwRg.css","./assets/index-CHFbPgKi.js","./assets/influence.worker-fQgTOG-K.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-DA91_00x.js","./assets/mesaChrome-DiK8GWwB.css","./assets/mesaSelection-Ck9g9s7F.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-BdLbRMPF.js","./assets/modelDoctorDiagnostics-QZT9TEgk.js","./assets/modelResult.worker-BWjNysfs.js","./assets/motionFeatures-B34evhs4.js","./assets/overlays-CZWnPnRt.js","./assets/pDelta-dXcjx5Vk.js","./assets/parametric.worker-vW6zyirt.js","./assets/pendingWrites-C6JNRrhs.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-BXR5p_kf.js","./assets/portablePayload-DM9Cd6LX.js","./assets/projectCommand-BBSTLFQS.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/react-CGTTGAiR.js","./assets/reinforcementAlternatives.worker-CgOzdbmB.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-LOsj-tPm.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/solver-C1cqPiwq.js","./assets/space3d.worker-CQqaPqzS.js","./assets/space3dAssign-rTiAYbwI.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-BecqDqoq.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-BO4FYPS-.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-BiAtMdxm.js","./assets/structuralEditing-N4paep_A.js","./assets/structureGeneration-DED-haPb.js","./assets/studies.worker-0HuPKxYN.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-BkIN1vHp.js","./assets/unifiedProjectSession-BQY5zn73.js","./assets/units-C8gzfA5I.js","./assets/units-De1rkpbk.js","./assets/usePersonalLibrary-BLvgA_4M.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-vhSaxURy.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
