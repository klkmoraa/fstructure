/* FStructure · service worker (plantilla: `vite.config.ts` la completa al compilar y la publica como `sw.js`).
 *
 * - Sólo lee del mismo origen y nunca envía datos: guarda la app en el dispositivo.
 * - La página (index.html) se pide primero a la red, para estrenar cada versión
 *   publicada; sin red se abre la guardada.
 * - Los archivos con huella (`assets/…`) no cambian nunca: se sirven de la caché.
 * - Una versión nueva espera a que se cierre la app para tomar el control, así
 *   una pestaña abierta nunca mezcla código de dos versiones.
 */
const VERSION = 'f497b1b94a30';
const PRECACHE = ["./","./assets/CommandPalette-BuiTEbtn.js","./assets/DatasheetPanel-DHG-lrOL.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-BlRX2cxg.js","./assets/DesignSurface-D6Ay4KXu.css","./assets/DesignSurface-UwtgsMl_.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/DxfImportDialog-kb11Y8q3.js","./assets/InfluenceLineView-CKOSV0Sz.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-DY4TQv-k.js","./assets/Model2DSurface-C0OCg6af.js","./assets/Model2DSurface-C8iM00bJ.css","./assets/ModelDoctor-CH-6YJkp.css","./assets/ModelDoctor-CoNmGoEW.js","./assets/NewExerciseDialog-8ze60m33.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-CSewAlxJ.js","./assets/PortableImportCenter-Bi0GLxnD.js","./assets/ResultExtremeCard-XGdHElUh.js","./assets/RevisionComparisonPanel-COMG7QJk.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/ShellToolSlots-CQ_bUsmJ.js","./assets/Space3DDefineDialogs-CZbitIHL.js","./assets/Space3DDynamicsDialog-Bdgld_dO.js","./assets/Space3DSurface-C0tKDxdY.css","./assets/Space3DSurface-Rf4lO67d.js","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-CKw6tmkF.js","./assets/StructureGeneratorSurface-mAnnGiDe.js","./assets/ToolShell-BssWy-9j.css","./assets/ToolShell-Dn6IxeNm.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-9hzVaUni.js","./assets/WorkspaceShell-DLD35cZz.css","./assets/analysis.worker-B2FAc8ft.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-BhRzFoon.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-Cm9KdXfd.js","./assets/catalogEn-CbxHeBbg.js","./assets/catalogEn-De1A6AuZ.js","./assets/certificate.worker-DtMmOleM.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-LX_uwK3m.js","./assets/commandPalette-C0vUB6ci.js","./assets/commandPalette-DQx9Afa5.css","./assets/controls-DDGNLH5c.js","./assets/defaultProject-DgVyu8JU.js","./assets/designReport-YB21hZkG.js","./assets/designWorkbenchCodec-BNdp9pDV.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-C-OvRZXc.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-DN_MVy_6.js","./assets/download-DkJ4a82X.js","./assets/editor-UcsczSRL.js","./assets/editorLayers-CVaeEQzG.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/grid-CMcgDHRy.js","./assets/index-BLiikLYJ.css","./assets/index-CLdFWDLr.js","./assets/influence.worker-fQgTOG-K.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-CFIddVFo.css","./assets/mesaChrome-D_sfdsl4.js","./assets/mesaSelection-BI_cxw81.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-BdLbRMPF.js","./assets/modelDoctorDiagnostics-91n5kfWT.js","./assets/modelResult.worker-Du8qsbPX.js","./assets/motionFeatures-DPGueeK8.js","./assets/overlays-RAtw-JGu.js","./assets/pDelta-BFrE-OE9.js","./assets/parametric.worker-vW6zyirt.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-Cu9lH1NM.js","./assets/portablePayload-B0WF0lZv.js","./assets/projectCommand-Ca8yRXaG.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/reinforcementAlternatives.worker-CqIbKHMO.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-LOsj-tPm.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/sliders-horizontal-BbQGX4oF.js","./assets/solver-CLntGvyY.js","./assets/space3d.worker-5HTJ40nX.js","./assets/space3dAssign-DghRXUm7.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-BcluVpHO.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-D1j9iFVQ.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-XyUwZ3oo.js","./assets/structuralEditing-Cnlox-it.js","./assets/structureGeneration-CXfqLupb.js","./assets/studies.worker-0HuPKxYN.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-BG--U6eO.js","./assets/triangle-alert-CHGz8kUJ.js","./assets/unifiedProjectSession-DaWc7FmG.js","./assets/units-C8gzfA5I.js","./assets/units-De1rkpbk.js","./assets/usePersonalLibrary-BLvgA_4M.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-DF8ykVvY.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
