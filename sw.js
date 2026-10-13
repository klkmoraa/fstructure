/* FStructure · service worker (plantilla: `vite.config.ts` la completa al compilar y la publica como `sw.js`).
 *
 * - Sólo lee del mismo origen y nunca envía datos: guarda la app en el dispositivo.
 * - La página (index.html) se pide primero a la red, para estrenar cada versión
 *   publicada; sin red se abre la guardada.
 * - Los archivos con huella (`assets/…`) no cambian nunca: se sirven de la caché.
 * - Una versión nueva espera a que se cierre la app para tomar el control, así
 *   una pestaña abierta nunca mezcla código de dos versiones.
 */
const VERSION = '5a7d6e9ae0e6';
const PRECACHE = ["./","./assets/CommandPalette-DzQlW-xe.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DatasheetPanel-ctL-tKU4.js","./assets/DenseResultsSurface-H5H8qHO2.js","./assets/DesignSurface-BCHvlZSt.js","./assets/DesignSurface-CqiA0HBU.css","./assets/DxfImportDialog-CcHphd-1.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-i5e07K3D.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-qpTV0ndt.js","./assets/Model2DSurface-DP7HzigN.js","./assets/Model2DSurface-DyjCoPGD.css","./assets/ModelDoctor-B-8xw64f.js","./assets/ModelDoctor-CH-6YJkp.css","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/NewExerciseDialog-fudKBue-.js","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-BzhRiBfR.js","./assets/PortableImportCenter-Fc94YsaW.js","./assets/ResultExtremeCard-B7-WdJkl.js","./assets/RevisionComparisonPanel-B8y3ZZn5.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/ShellToolSlots-CAVm5Bt4.js","./assets/Space3DDefineDialogs-D7nihtzJ.js","./assets/Space3DDynamicsDialog-Bex6iv7h.js","./assets/Space3DSurface-C0tKDxdY.css","./assets/Space3DSurface-Cy39Y8Xy.js","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-CpfGBlZE.js","./assets/StructureGeneratorSurface-C1_WRitD.js","./assets/ToolShell-BssWy-9j.css","./assets/ToolShell-DbXJ5YqO.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-8CJWfUDO.js","./assets/WorkspaceShell-DLD35cZz.css","./assets/analysis.worker-B2FAc8ft.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-MbxPMEEC.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-Dvo9-iFE.js","./assets/catalogEn-Dd3QMsVd.js","./assets/catalogEn-De1A6AuZ.js","./assets/certificate.worker-DtMmOleM.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-kDP8avb_.js","./assets/commandPalette-DQx9Afa5.css","./assets/commandPalette-TERZjzDB.js","./assets/controls-DDGNLH5c.js","./assets/defaultProject-D9LLfxEp.js","./assets/designReport-DGXP9SFM.js","./assets/designWorkbenchCodec-BiwOJjy8.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-DRfajSJS.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-DN_MVy_6.js","./assets/download-DkJ4a82X.js","./assets/editor-UcsczSRL.js","./assets/editorLayers-sv-0M0Xn.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/grid-CMcgDHRy.js","./assets/index-9fADK72P.css","./assets/index-ufocHmU-.js","./assets/influence.worker-fQgTOG-K.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-BEvi4oO_.js","./assets/mesaChrome-CFIddVFo.css","./assets/mesaSelection-BgVKyE2J.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-BdLbRMPF.js","./assets/modelDoctorDiagnostics-C9eXZTZp.js","./assets/modelResult.worker-CVcsjK3v.js","./assets/motionFeatures-f2yn2cOk.js","./assets/overlays-BffxFQ8g.js","./assets/pDelta-rdXSXo4o.js","./assets/parametric.worker-vW6zyirt.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-Cu9lH1NM.js","./assets/portablePayload-WSXViPqO.js","./assets/projectCommand-Cl0mWji_.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/reinforcementAlternatives.worker-NGE-K5Vs.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-LOsj-tPm.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/sliders-horizontal-BbQGX4oF.js","./assets/solver-BW9n8AOS.js","./assets/space3d.worker-Ci5JlLHx.js","./assets/space3dAssign-DghRXUm7.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-b-g9ueKN.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-fkxMPhFc.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-Cv_dcydU.js","./assets/structuralEditing-CzN5JZpt.js","./assets/structureGeneration-d8HAJLgY.js","./assets/studies.worker-0HuPKxYN.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-F6GRBejN.js","./assets/triangle-alert-CHGz8kUJ.js","./assets/unifiedProjectSession-B_xoOiU8.js","./assets/units-Bu9sDGHU.js","./assets/units-DNylVOSp.js","./assets/usePersonalLibrary-BBlimIYH.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-OlW8QnjU.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
