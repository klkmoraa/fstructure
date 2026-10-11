/* FStructure · service worker (plantilla: `vite.config.ts` la completa al compilar y la publica como `sw.js`).
 *
 * - Sólo lee del mismo origen y nunca envía datos: guarda la app en el dispositivo.
 * - La página (index.html) se pide primero a la red, para estrenar cada versión
 *   publicada; sin red se abre la guardada.
 * - Los archivos con huella (`assets/…`) no cambian nunca: se sirven de la caché.
 * - Una versión nueva espera a que se cierre la app para tomar el control, así
 *   una pestaña abierta nunca mezcla código de dos versiones.
 */
const VERSION = 'a3313ecc7149';
const PRECACHE = ["./","./assets/CommandPalette-CjFxcq5X.js","./assets/DatasheetPanel-CArHd1i4.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-CJUarlcJ.js","./assets/DesignSurface-0TnMOmYn.js","./assets/DesignSurface-CqiA0HBU.css","./assets/DxfImportDialog-BXbl-KGY.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-C7y0-Xr_.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-C8cEZFK7.js","./assets/Model2DSurface-DMYFqsGq.js","./assets/Model2DSurface-DyjCoPGD.css","./assets/ModelDoctor-BnIyKIzg.js","./assets/ModelDoctor-CH-6YJkp.css","./assets/NewExerciseDialog-C-yxNO7w.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-C8mXtvqe.js","./assets/PortableImportCenter-C-gYGMYO.js","./assets/ResultExtremeCard-CaBfKU_t.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/RevisionComparisonPanel-Ki9InDuZ.js","./assets/SectionBuilder--k7EEZet.js","./assets/ShellToolSlots-CT54BTMU.js","./assets/Space3DDefineDialogs-BJceQdQO.js","./assets/Space3DDynamicsDialog-DYl5AhwW.js","./assets/Space3DSurface-C0tKDxdY.css","./assets/Space3DSurface-Cf2Y4RkQ.js","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-DuRxwR0J.js","./assets/StructureGeneratorSurface-DTK0Oo0O.js","./assets/ToolShell-BssWy-9j.css","./assets/ToolShell-D2P3Lmsk.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-DVAJydKW.css","./assets/WorkspaceShell-aCbS4HRb.js","./assets/analysis.worker-beLaJjLs.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-WUHDSj8f.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-Ca8EHtH_.js","./assets/catalogEn-DMw7O8Rv.js","./assets/catalogEn-De1A6AuZ.js","./assets/certificate.worker-DMdU7CgY.js","./assets/check-BjfGI028.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-kDP8avb_.js","./assets/commandPalette-BbA-6ENx.js","./assets/commandPalette-DQx9Afa5.css","./assets/controls-DDGNLH5c.js","./assets/defaultProject-ClDHAwHl.js","./assets/designReport-NiWnHDTx.js","./assets/designWorkbenchCodec-BiwOJjy8.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-ZCxghrJe.css","./assets/diagramBands-tGW3g3SL.js","./assets/disclosure-DN_MVy_6.js","./assets/download-DkJ4a82X.js","./assets/editor-UcsczSRL.js","./assets/editorLayers-BART-eXK.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/grid-CMcgDHRy.js","./assets/index--nxGSf26.css","./assets/index-DnMx_WKA.js","./assets/influence.worker-C85oJL11.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/mesaChrome-Bh2HiipG.js","./assets/mesaChrome-CFIddVFo.css","./assets/mesaSelection-zYsS48Oa.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-CgCJSyGV.js","./assets/modelDoctorDiagnostics-CCq-P3LY.js","./assets/modelResult.worker-3r-IXyue.js","./assets/motionFeatures-CD_dZBrB.js","./assets/overlays-CWD7Qjvy.js","./assets/pDelta-BUb0-ETN.js","./assets/parametric.worker-CJC23J5k.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-Cu9lH1NM.js","./assets/portablePayload-DFAEmuND.js","./assets/projectCommand-BNaO87lY.js","./assets/projectSignature-Bj8f1QAV.js","./assets/react-9ZasmZpi.js","./assets/reinforcementAlternatives.worker-JNAryuaN.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-DgM3eQcU.js","./assets/sectionGeometry-JD0WF4HJ.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/sliders-horizontal-BbQGX4oF.js","./assets/solver-UH4pQxsx.js","./assets/space3d.worker-Ci5JlLHx.js","./assets/space3dAssign-DghRXUm7.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-B1fybw8l.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-B0piPV-d.js","./assets/storage-fkxMPhFc.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-gbgAGlGJ.js","./assets/structuralEditing-DSUyPu0L.js","./assets/structureGeneration-BCp9fJp3.js","./assets/studies.worker-B1_mpFqY.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-CNkCZ_R4.js","./assets/triangle-alert-CHGz8kUJ.js","./assets/unifiedProjectSession-CIGr0NiG.js","./assets/units-Bu9sDGHU.js","./assets/units-DNylVOSp.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-Dirm9qb3.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
