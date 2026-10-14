/* FStructure · service worker (plantilla: `vite.config.ts` la completa al compilar y la publica como `sw.js`).
 *
 * - Sólo lee del mismo origen y nunca envía datos: guarda la app en el dispositivo.
 * - La página (index.html) se pide primero a la red, para estrenar cada versión
 *   publicada; sin red se abre la guardada.
 * - Los archivos con huella (`assets/…`) no cambian nunca: se sirven de la caché.
 * - Una versión nueva espera a que se cierre la app para tomar el control, así
 *   una pestaña abierta nunca mezcla código de dos versiones.
 */
const VERSION = 'b154c7824c83';
const PRECACHE = ["./","./assets/CommandPalette-i_LgaOKj.js","./assets/DatasheetPanel-4iOP6g8u.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-CM5k305U.js","./assets/DesignSurface-D6Ay4KXu.css","./assets/DesignSurface-DJQ_Mawe.js","./assets/DxfImportDialog-CDzBGhq_.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-DKQElumn.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-CUuYpe1w.js","./assets/Model2DSurface-C8iM00bJ.css","./assets/Model2DSurface-D6fvKc3Q.js","./assets/ModelDoctor-B6UnIcN_.js","./assets/ModelDoctor-CH-6YJkp.css","./assets/NewExerciseDialog-BinsnJkC.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-CfkfktoI.js","./assets/PortableImportCenter-DBxchvJi.js","./assets/ResultExtremeCard-BpOpPmC_.js","./assets/RevisionComparisonPanel-C50nmIW1.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/ShellToolSlots-bHDMWBll.js","./assets/Space3DDefineDialogs-BO3Uj9A1.js","./assets/Space3DDynamicsDialog-9rbWR27r.js","./assets/Space3DSurface-C0tKDxdY.css","./assets/Space3DSurface-m7tAc0gr.js","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-CoNISGVa.js","./assets/StructureGeneratorSurface-D9lh3rkL.js","./assets/ToolShell-BssWy-9j.css","./assets/ToolShell-CHGh5e7t.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-CjSeqUDO.js","./assets/WorkspaceShell-DLD35cZz.css","./assets/analysis.worker-B2FAc8ft.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-BhRzFoon.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-BHUz18AA.js","./assets/catalogEn-CbxHeBbg.js","./assets/catalogEn-De1A6AuZ.js","./assets/certificate.worker-DtMmOleM.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-LX_uwK3m.js","./assets/commandPalette-DQx9Afa5.css","./assets/commandPalette-FAMB_Wqo.js","./assets/controls-DDGNLH5c.js","./assets/defaultProject-DgVyu8JU.js","./assets/designReport-BnOUckJ3.js","./assets/designWorkbenchCodec-BNdp9pDV.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-CWtpgwdz.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-DN_MVy_6.js","./assets/download-DkJ4a82X.js","./assets/editor-UcsczSRL.js","./assets/editorLayers-Bi0bRyzA.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/grid-CMcgDHRy.js","./assets/index-BLiikLYJ.css","./assets/index-CgvwI0UY.js","./assets/influence.worker-fQgTOG-K.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-CFIddVFo.css","./assets/mesaChrome-XGZqv5f5.js","./assets/mesaSelection-3Sf3_pR-.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-BdLbRMPF.js","./assets/modelDoctorDiagnostics-CW8lqC-m.js","./assets/modelResult.worker-Du8qsbPX.js","./assets/motionFeatures-CKI7wkiy.js","./assets/overlays-WnpAC9hM.js","./assets/pDelta-mlhXxkhJ.js","./assets/parametric.worker-vW6zyirt.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-Cu9lH1NM.js","./assets/portablePayload-VrvccXj8.js","./assets/projectCommand-BsTMVcu5.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/reinforcementAlternatives.worker-CqIbKHMO.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-LOsj-tPm.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/sliders-horizontal-BbQGX4oF.js","./assets/solver-Ds5dPW4E.js","./assets/space3d.worker-5HTJ40nX.js","./assets/space3dAssign-DghRXUm7.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-BcluVpHO.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-D1j9iFVQ.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-BUfk67Gh.js","./assets/structuralEditing-DPyFXmxR.js","./assets/structureGeneration-z3Ef6Jn0.js","./assets/studies.worker-0HuPKxYN.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-m6HHJ8iI.js","./assets/triangle-alert-CHGz8kUJ.js","./assets/unifiedProjectSession-UQg2QORO.js","./assets/units-C8gzfA5I.js","./assets/units-De1rkpbk.js","./assets/usePersonalLibrary-BLvgA_4M.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-CxATAdU5.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
