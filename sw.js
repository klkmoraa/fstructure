/* FStructure · service worker (plantilla: `vite.config.ts` la completa al compilar y la publica como `sw.js`).
 *
 * - Sólo lee del mismo origen y nunca envía datos: guarda la app en el dispositivo.
 * - La página (index.html) se pide primero a la red, para estrenar cada versión
 *   publicada; sin red se abre la guardada.
 * - Los archivos con huella (`assets/…`) no cambian nunca: se sirven de la caché.
 * - Una versión nueva espera a que se cierre la app para tomar el control, así
 *   una pestaña abierta nunca mezcla código de dos versiones.
 */
const VERSION = '26bd03bbefb9';
const PRECACHE = ["./","./assets/CommandPalette-BNjxRitE.js","./assets/DatasheetPanel-Ca_96fJA.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-CYcVeQfF.js","./assets/DesignSurface-1Y00etwm.js","./assets/DesignSurface-F3RmZcCo.css","./assets/DxfImportDialog-BFctGhY_.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-DQyZbl6A.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-CrXbHoBY.js","./assets/Model2DSurface-DyjCoPGD.css","./assets/Model2DSurface-J0lkZXyU.js","./assets/ModelDoctor-CH-6YJkp.css","./assets/ModelDoctor-D6hknJ8Z.js","./assets/NewExerciseDialog-DFcUfBOY.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-DE78YIeL.js","./assets/PortableImportCenter-ChubEq6a.js","./assets/ResultExtremeCard-BuMxObef.js","./assets/RevisionComparisonPanel-BJTabwvd.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/ShellToolSlots-DNIcbGgn.js","./assets/Space3DDefineDialogs-Dvop7Te4.js","./assets/Space3DDynamicsDialog-C1OSlO9r.js","./assets/Space3DSurface-2L6TO6Xd.js","./assets/Space3DSurface-C0tKDxdY.css","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-eCJhd52Y.js","./assets/StructureGeneratorSurface-DLOElKTB.js","./assets/ToolShell-Bg_yIslH.js","./assets/ToolShell-BssWy-9j.css","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-B_pYzK4l.js","./assets/WorkspaceShell-DLD35cZz.css","./assets/analysis.worker-B2FAc8ft.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-MbxPMEEC.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-BXtVLwKK.js","./assets/catalogEn-Dd3QMsVd.js","./assets/catalogEn-De1A6AuZ.js","./assets/certificate.worker-DtMmOleM.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-LX_uwK3m.js","./assets/commandPalette-C8lx7Sya.js","./assets/commandPalette-DQx9Afa5.css","./assets/controls-DDGNLH5c.js","./assets/defaultProject-D-J-ft_o.js","./assets/designReport-UOMQCTHS.js","./assets/designWorkbenchCodec-BNdp9pDV.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-CAXpSUtB.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-DN_MVy_6.js","./assets/download-DkJ4a82X.js","./assets/editor-UcsczSRL.js","./assets/editorLayers-BHiIg2nD.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/grid-CMcgDHRy.js","./assets/index-BLiikLYJ.css","./assets/index-DIY75Tdj.js","./assets/influence.worker-fQgTOG-K.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-BsMNoE1O.js","./assets/mesaChrome-CFIddVFo.css","./assets/mesaSelection-BYrUynLU.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-BdLbRMPF.js","./assets/modelDoctorDiagnostics-HLpEogjr.js","./assets/modelResult.worker-Du8qsbPX.js","./assets/motionFeatures-l2lzabl6.js","./assets/overlays-CCnTUqk5.js","./assets/pDelta-DA1a9axb.js","./assets/parametric.worker-vW6zyirt.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-Cu9lH1NM.js","./assets/portablePayload-CBFhbMFz.js","./assets/projectCommand-B4p_2cJZ.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/reinforcementAlternatives.worker-NGE-K5Vs.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-LOsj-tPm.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/sliders-horizontal-BbQGX4oF.js","./assets/solver-CiKYbgWx.js","./assets/space3d.worker-5HTJ40nX.js","./assets/space3dAssign-DghRXUm7.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-DKo9jGJZ.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-D1j9iFVQ.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-CNsIs-JT.js","./assets/structuralEditing-BBDpnWYy.js","./assets/structureGeneration-BmY39k1Y.js","./assets/studies.worker-0HuPKxYN.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-CZ8O3lmM.js","./assets/triangle-alert-CHGz8kUJ.js","./assets/unifiedProjectSession-D7KR7l2R.js","./assets/units-C8gzfA5I.js","./assets/units-De1rkpbk.js","./assets/usePersonalLibrary-BLvgA_4M.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-C0aW3NwD.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
