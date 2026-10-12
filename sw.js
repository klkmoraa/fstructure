/* FStructure · service worker (plantilla: `vite.config.ts` la completa al compilar y la publica como `sw.js`).
 *
 * - Sólo lee del mismo origen y nunca envía datos: guarda la app en el dispositivo.
 * - La página (index.html) se pide primero a la red, para estrenar cada versión
 *   publicada; sin red se abre la guardada.
 * - Los archivos con huella (`assets/…`) no cambian nunca: se sirven de la caché.
 * - Una versión nueva espera a que se cierre la app para tomar el control, así
 *   una pestaña abierta nunca mezcla código de dos versiones.
 */
const VERSION = '9fc03964b6ee';
const PRECACHE = ["./","./assets/CommandPalette-CJCwz_a2.js","./assets/DatasheetPanel-BRwXFvDM.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-BuuaPS45.js","./assets/DesignSurface-CqiA0HBU.css","./assets/DesignSurface-CrwuWOvt.js","./assets/DxfImportDialog-DTYU9mqt.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-Dbx6_4Lh.js","./assets/LocalCommandAssistant-BD0NOwRz.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/Model2DSurface-CyQKper5.js","./assets/Model2DSurface-DyjCoPGD.css","./assets/ModelDoctor-CH-6YJkp.css","./assets/ModelDoctor-DM67t5_K.js","./assets/NewExerciseDialog-Bf1c2Tq-.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-tdZiH12Y.js","./assets/PortableImportCenter-Bt7_PKe6.js","./assets/ResultExtremeCard-GUGIsVLb.js","./assets/RevisionComparisonPanel-9MwFV0Ky.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/SectionBuilder-Dr54zu1B.js","./assets/ShellToolSlots-h04EdSEm.js","./assets/Space3DDefineDialogs-1Kq323ov.js","./assets/Space3DDynamicsDialog-ItdtO8Ku.js","./assets/Space3DSurface-C0tKDxdY.css","./assets/Space3DSurface-Dp6IRWxz.js","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-CYNrjQpz.js","./assets/StructureGeneratorSurface-DFbbBM02.js","./assets/ToolShell-BssWy-9j.css","./assets/ToolShell-CNI0SzUD.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-BY9aDaBd.js","./assets/WorkspaceShell-DVAJydKW.css","./assets/analysis.worker-beLaJjLs.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-WUHDSj8f.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-WaYmhagt.js","./assets/catalogEn-DMw7O8Rv.js","./assets/catalogEn-De1A6AuZ.js","./assets/certificate.worker-DMdU7CgY.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-kDP8avb_.js","./assets/commandPalette-Cr_9DN8x.js","./assets/commandPalette-DQx9Afa5.css","./assets/controls-DDGNLH5c.js","./assets/defaultProject-ClDHAwHl.js","./assets/designReport-B4NA4t8k.js","./assets/designWorkbenchCodec-BiwOJjy8.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-DHdn-7Yw.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-DN_MVy_6.js","./assets/download-DkJ4a82X.js","./assets/editor-UcsczSRL.js","./assets/editorLayers-Bghq_LrX.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/grid-CMcgDHRy.js","./assets/index-9fADK72P.css","./assets/index-D6YdRwy9.js","./assets/influence.worker-C85oJL11.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/mesaChrome-CFIddVFo.css","./assets/mesaChrome-DiRcCnsT.js","./assets/mesaSelection-Bk2QXTlQ.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-CgCJSyGV.js","./assets/modelDoctorDiagnostics-CBcYbYYl.js","./assets/modelResult.worker-3r-IXyue.js","./assets/motionFeatures-Bu-JY6xg.js","./assets/overlays-ChN4DrhK.js","./assets/pDelta-BwhLJA5y.js","./assets/parametric.worker-CJC23J5k.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-Cu9lH1NM.js","./assets/portablePayload-DQVCXdDX.js","./assets/projectCommand-uCLBUE2t.js","./assets/projectSignature-Bj8f1QAV.js","./assets/react-9ZasmZpi.js","./assets/reinforcementAlternatives.worker-JNAryuaN.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-DgM3eQcU.js","./assets/sectionGeometry-JD0WF4HJ.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/sliders-horizontal-BbQGX4oF.js","./assets/solver-CW3yI5cX.js","./assets/space3d.worker-Ci5JlLHx.js","./assets/space3dAssign-DghRXUm7.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-B1fybw8l.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-B0piPV-d.js","./assets/storage-fkxMPhFc.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-D6_ug8Jk.js","./assets/structuralEditing-0ACG2den.js","./assets/structureGeneration-CWZJ7Z1s.js","./assets/studies.worker-B1_mpFqY.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-BMolwooH.js","./assets/triangle-alert-CHGz8kUJ.js","./assets/unifiedProjectSession-FmPxcgYR.js","./assets/units-Bu9sDGHU.js","./assets/units-DNylVOSp.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-DnBGWYGp.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
