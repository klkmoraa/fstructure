/* FStructure · service worker (plantilla: `vite.config.ts` la completa al compilar y la publica como `sw.js`).
 *
 * - Sólo lee del mismo origen y nunca envía datos: guarda la app en el dispositivo.
 * - La página (index.html) se pide primero a la red, para estrenar cada versión
 *   publicada; sin red se abre la guardada.
 * - Los archivos con huella (`assets/…`) no cambian nunca: se sirven de la caché.
 * - Una versión nueva espera a que se cierre la app para tomar el control, así
 *   una pestaña abierta nunca mezcla código de dos versiones.
 */
const VERSION = '84331f3cde8c';
const PRECACHE = ["./","./assets/CommandPalette-BAMUL3oX.js","./assets/DatasheetPanel-D5r6-k5U.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-CU9cEddJ.js","./assets/DesignSurface-CV78dFWf.js","./assets/DesignSurface-F3RmZcCo.css","./assets/DxfImportDialog-CXr1WTkh.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-B5AqwXcT.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-DKhzSFjb.js","./assets/Model2DSurface-DxUrlSuD.js","./assets/Model2DSurface-DyjCoPGD.css","./assets/ModelDoctor-CH-6YJkp.css","./assets/ModelDoctor-D7oDj5PO.js","./assets/NewExerciseDialog-CDGwAn-c.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-DBAVADL_.js","./assets/PortableImportCenter-mRJ9gQMD.js","./assets/ResultExtremeCard-CAukv3fP.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/RevisionComparisonPanel-wIqIZJ7b.js","./assets/ShellToolSlots-GO9FYcx5.js","./assets/Space3DDefineDialogs-BXFev5y_.js","./assets/Space3DDynamicsDialog-BZlbY7BZ.js","./assets/Space3DSurface-C0tKDxdY.css","./assets/Space3DSurface-DfQxJ5iA.js","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-CHEGv_zg.js","./assets/StructureGeneratorSurface-DSNNpKcu.js","./assets/ToolShell-B8jrc17b.js","./assets/ToolShell-BssWy-9j.css","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-Cy5PucQD.js","./assets/WorkspaceShell-DLD35cZz.css","./assets/analysis.worker-B2FAc8ft.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-MbxPMEEC.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-CAev1E-f.js","./assets/catalogEn-Dd3QMsVd.js","./assets/catalogEn-De1A6AuZ.js","./assets/certificate.worker-DtMmOleM.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-kDP8avb_.js","./assets/commandPalette-DM5DzG9m.js","./assets/commandPalette-DQx9Afa5.css","./assets/controls-DDGNLH5c.js","./assets/defaultProject-D-J-ft_o.js","./assets/designReport-OQcRa-yw.js","./assets/designWorkbenchCodec-BiwOJjy8.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-BvsCzlU5.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-DN_MVy_6.js","./assets/download-DkJ4a82X.js","./assets/editor-UcsczSRL.js","./assets/editorLayers-Blz2__L1.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/grid-CMcgDHRy.js","./assets/index-BMhXkBIj.css","./assets/index-BoZYc0MD.js","./assets/influence.worker-fQgTOG-K.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberProfiles-CUQCGfL8.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-CFIddVFo.css","./assets/mesaChrome-DS831CMg.js","./assets/mesaSelection-8Kwc98QL.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-BdLbRMPF.js","./assets/modelDoctorDiagnostics-6yTHfzhj.js","./assets/modelResult.worker-CVcsjK3v.js","./assets/motionFeatures-DXLNNbnF.js","./assets/overlays-8-m6RJwy.js","./assets/pDelta-Cz44Z4Rl.js","./assets/parametric.worker-vW6zyirt.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-Cu9lH1NM.js","./assets/portablePayload-ClFJIAtb.js","./assets/projectCommand-B-qMsFvU.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/reinforcementAlternatives.worker-NGE-K5Vs.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-LOsj-tPm.js","./assets/sectionGeometry-EKbY-uNu.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/sliders-horizontal-BbQGX4oF.js","./assets/solver-BGJgSKZE.js","./assets/space3d.worker-Ci5JlLHx.js","./assets/space3dAssign-DghRXUm7.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-b-g9ueKN.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-CilDposz.js","./assets/storage-fkxMPhFc.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-DlPK6y4G.js","./assets/structuralEditing-BdlbkMte.js","./assets/structureGeneration-CMNtRE8l.js","./assets/studies.worker-0HuPKxYN.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-CJuz3g2L.js","./assets/triangle-alert-CHGz8kUJ.js","./assets/unifiedProjectSession-3sFXulc3.js","./assets/units-Bu9sDGHU.js","./assets/units-DNylVOSp.js","./assets/usePersonalLibrary-BBlimIYH.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-vqTDD76O.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
