/* FStructure · service worker (plantilla: `vite.config.ts` la completa al compilar y la publica como `sw.js`).
 *
 * - Sólo lee del mismo origen y nunca envía datos: guarda la app en el dispositivo.
 * - La página (index.html) se pide primero a la red, para estrenar cada versión
 *   publicada; sin red se abre la guardada.
 * - Los archivos con huella (`assets/…`) no cambian nunca: se sirven de la caché.
 * - Una versión nueva espera a que se cierre la app para tomar el control, así
 *   una pestaña abierta nunca mezcla código de dos versiones.
 */
const VERSION = 'd5009217c84e';
const PRECACHE = ["./","./assets/CommandPalette-D6xyqhu7.js","./assets/DatasheetPanel-BQDxBcGd.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-BayZqj8m.js","./assets/DesignSurface-CqiA0HBU.css","./assets/DesignSurface-D0qLy1O7.js","./assets/DxfImportDialog-BRD607mS.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-Dx6EhOm3.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-D8x6RqKQ.js","./assets/Model2DSurface-C_exK_ed.js","./assets/Model2DSurface-DyjCoPGD.css","./assets/ModelDoctor-CH-6YJkp.css","./assets/ModelDoctor-DueQhTwt.js","./assets/NewExerciseDialog-BVSiBrZQ.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-A3ns3HLs.js","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PortableImportCenter-DqMijq0T.js","./assets/ResultExtremeCard-BHUnBJT3.js","./assets/RevisionComparisonPanel-BDWH4VY8.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/SectionBuilder-CIryWcZv.js","./assets/ShellToolSlots-CFRwtL7w.js","./assets/Space3DDefineDialogs-RrJShWK7.js","./assets/Space3DDynamicsDialog-oifcfzy-.js","./assets/Space3DSurface-C0tKDxdY.css","./assets/Space3DSurface-Dns1Q2WY.js","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-BATJJeKo.js","./assets/StructureGeneratorSurface-r6zUTES4.js","./assets/ToolShell-BqY4ODeh.js","./assets/ToolShell-BssWy-9j.css","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-B3ux0zaI.js","./assets/WorkspaceShell-C5iRN4ko.css","./assets/analysis.worker-C2H3jbPw.js","./assets/appVersion-CkWiFJON.js","./assets/beamSectionProposal.worker-DfDUOoCE.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-DgwwUZ6a.js","./assets/catalogEn-De1A6AuZ.js","./assets/catalogEn-P1u7nQRQ.js","./assets/certificate.worker-CjmUgT0A.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-kDP8avb_.js","./assets/commandPalette-BSTcCUpD.js","./assets/commandPalette-DQx9Afa5.css","./assets/controls-DDGNLH5c.js","./assets/defaultProject-CeAH7sCS.js","./assets/designReport-Cgi8Yip8.js","./assets/designWorkbenchCodec-BiwOJjy8.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-DhjsAsDy.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-DN_MVy_6.js","./assets/download-DkJ4a82X.js","./assets/editor-UcsczSRL.js","./assets/editorLayers-B6VC6Ad9.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/flexureProposal.worker-BsqpNl5E.js","./assets/grid-CMcgDHRy.js","./assets/index-9fADK72P.css","./assets/index-Cn0kW3Q9.js","./assets/influence.worker-D8LhTGI5.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/memberStiffness-CkTvDCyi.js","./assets/mesaChrome-CFIddVFo.css","./assets/mesaChrome-CXtdDLr1.js","./assets/mesaSelection-TRmgH73_.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-DbXOocDG.js","./assets/modelDoctorDiagnostics-DgpyETOD.js","./assets/modelResult.worker-DF9fODjL.js","./assets/motionFeatures-Bgm_xhaN.js","./assets/overlays-CejeqIvs.js","./assets/pDelta-CZltZ2U7.js","./assets/parametric.worker-BVNXMCCz.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-Cu9lH1NM.js","./assets/portablePayload-jh7rnDac.js","./assets/projectCommand-CWeWTQOK.js","./assets/projectSignature-DtNiRcau.js","./assets/react-9ZasmZpi.js","./assets/reinforcementAlternatives.worker-Burx_uIY.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-7FgT64Sx.js","./assets/sectionGeometry-JD0WF4HJ.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/sliders-horizontal-BbQGX4oF.js","./assets/solver-BU04xUHB.js","./assets/space3d.worker-Ci5JlLHx.js","./assets/space3dAssign-DghRXUm7.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-BnNnFOPU.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-B0piPV-d.js","./assets/storage-fkxMPhFc.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-DNpxmny6.js","./assets/structuralEditing-ByrvGenD.js","./assets/structureGeneration-OokMCKZ6.js","./assets/studies.worker-Dtok05r2.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-BVWSn2lw.js","./assets/triangle-alert-CHGz8kUJ.js","./assets/unifiedProjectSession-CV5180-E.js","./assets/units-Bu9sDGHU.js","./assets/units-DNylVOSp.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-CHB-Nkcm.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
