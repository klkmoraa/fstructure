/* FStructure · service worker (plantilla: `vite.config.ts` la completa al compilar y la publica como `sw.js`).
 *
 * - Sólo lee del mismo origen y nunca envía datos: guarda la app en el dispositivo.
 * - La página (index.html) se pide primero a la red, para estrenar cada versión
 *   publicada; sin red se abre la guardada.
 * - Los archivos con huella (`assets/…`) no cambian nunca: se sirven de la caché.
 * - Una versión nueva espera a que se cierre la app para tomar el control, así
 *   una pestaña abierta nunca mezcla código de dos versiones.
 */
const VERSION = '32a8abec74aa';
const PRECACHE = ["./","./assets/CommandPalette-DBGlhWTx.js","./assets/DatasheetPanel-ClXIVoOG.js","./assets/DatasheetPanel-TPukyFRG.css","./assets/DenseResultsSurface-BS_FV2WE.js","./assets/DesignSurface-Be4CxF2d.js","./assets/DesignSurface-D45Gnpbc.css","./assets/DxfImportDialog-B1iK6ndi.js","./assets/DxfImportDialog-DYJrNAeF.css","./assets/InfluenceLineView-Bk7B1TLl.js","./assets/LocalCommandAssistant-BIXh2T05.css","./assets/LocalCommandAssistant-BvEqrkRC.js","./assets/Model2DSurface-B8boBb-m.js","./assets/Model2DSurface-DyjCoPGD.css","./assets/ModelDoctor-BXPjcUuS.js","./assets/ModelDoctor-CH-6YJkp.css","./assets/NewExerciseDialog-BzZgCKuQ.js","./assets/NewExerciseDialog-V9ZIzMcB.css","./assets/PersonalLibraryView-BB8YvmNl.css","./assets/PersonalLibraryView-Djdt0_uL.js","./assets/PortableImportCenter-9ZYs-FR7.js","./assets/ResultExtremeCard-CSdpS-HQ.js","./assets/RevisionComparisonPanel-DNtHLukD.css","./assets/RevisionComparisonPanel-Dg1YRSeL.js","./assets/SectionBuilder-BJdjf2WH.js","./assets/ShellToolSlots-D3Sy844v.js","./assets/Space3DDefineDialogs-BJiA_XfT.js","./assets/Space3DDynamicsDialog-BttZJt7k.js","./assets/Space3DSurface-5pXSNQJf.css","./assets/Space3DSurface-KYx-Pu9b.js","./assets/StructuralBomPanel-2jHJdnFh.css","./assets/StructuralBomPanel-CBjqjgjL.js","./assets/StructureGeneratorSurface-DfwiaiTd.js","./assets/ToolShell-BssWy-9j.css","./assets/ToolShell-CetyhJCk.js","./assets/VisualElement-D7DCu4Eb.js","./assets/WorkspaceShell-B16L1jr5.js","./assets/WorkspaceShell-DVAJydKW.css","./assets/analysis.worker-beLaJjLs.js","./assets/appVersion-CkWiFJON.js","./assets/box-Bt2A9AMK.js","./assets/browser-gNs4Adlk.js","./assets/bulkEditPresentation-D-Px4VBU.js","./assets/catalogEn-DMw7O8Rv.js","./assets/catalogEn-De1A6AuZ.js","./assets/certificate.worker-DMdU7CgY.js","./assets/check-BjfGI028.js","./assets/circle-question-mark-B8J7AwB4.js","./assets/codec-kDP8avb_.js","./assets/commandPalette-Bmt9ZQxF.js","./assets/commandPalette-DQx9Afa5.css","./assets/controls-DDGNLH5c.js","./assets/defaultProject-DgotYu1Q.js","./assets/designReport-Ddk6qJfk.js","./assets/diagram-CkW9a-5r.js","./assets/diagramBands-D-W5JPoV.js","./assets/diagramBands-ZCxghrJe.css","./assets/disclosure-DN_MVy_6.js","./assets/download-DkJ4a82X.js","./assets/editor-UcsczSRL.js","./assets/editorLayers-C0TSxdab.js","./assets/en-analysis-FYg01m3B.js","./assets/es-CEbGEA7n.js","./assets/file-text-DZMEv9SM.js","./assets/filter-props-CyGY_Gf-.js","./assets/grid-CMcgDHRy.js","./assets/index-BhzoIWg0.css","./assets/index-VoI45JB2.js","./assets/influence.worker-C85oJL11.js","./assets/is-ref-object-Ci8gSvuB.js","./assets/jsx-runtime-DiK4U9sA.js","./assets/lightbulb-B0kve1Rx.js","./assets/loader-circle-D08eVkie.js","./assets/mesaChrome-Bew31mBN.css","./assets/mesaChrome-Vxm0kjxi.js","./assets/mesaSelection-hEdcmopK.js","./assets/modalFocus-zk4zHnq8.js","./assets/model2dDesign.worker-CgCJSyGV.js","./assets/modelDoctorDiagnostics-DDQA6vOY.js","./assets/motionFeatures-DcUT6JsE.js","./assets/overlays-DUrDOfF0.js","./assets/pDelta-qs6oFchb.js","./assets/parametric.worker-CJC23J5k.js","./assets/plus-BKreJuFE.js","./assets/portableDownload-Cu9lH1NM.js","./assets/portablePayload-D84u-PXG.js","./assets/projectCommand-Bt_RyyYj.js","./assets/projectSignature-Bj8f1QAV.js","./assets/react-9ZasmZpi.js","./assets/reinforcementProposal.worker-6ID8slYc.js","./assets/reportContext-SAqZAJrf.js","./assets/rolldown-runtime-CNC7AqOf.js","./assets/ruler-XWMgVyMF.js","./assets/scenarios.worker-DgM3eQcU.js","./assets/sectionGeometry-JD0WF4HJ.js","./assets/shield-check-CvxkErC7.js","./assets/sigma-BztSyeKO.js","./assets/sliders-horizontal-BbQGX4oF.js","./assets/solver-v7xmO5gI.js","./assets/space3d.worker-Ci5JlLHx.js","./assets/space3dAssign-DghRXUm7.js","./assets/space3dDefine-BC7irc2O.js","./assets/space3dDesign.worker-1R324r4U.js","./assets/space3dNumberFormat-BQIktUVW.js","./assets/sparkles-BkYP2rkn.js","./assets/standardSections-B0piPV-d.js","./assets/storage-fkxMPhFc.js","./assets/structural-BEuEAJB2.js","./assets/structuralBom-CBgOTScn.js","./assets/structuralEditing-BtGH0Aaz.js","./assets/structureGeneration-GgtZB5M0.js","./assets/studies.worker-B1_mpFqY.js","./assets/three.module-9-80EJJx.js","./assets/threeStructuralRender-DcDXbvPO.js","./assets/triangle-alert-CHGz8kUJ.js","./assets/unifiedProjectSession-UZFBpDUK.js","./assets/units-Bu9sDGHU.js","./assets/units-DNylVOSp.js","./assets/weight-CAMbm92N.js","./assets/workerHandlers-D87hAWzT.js","./assets/wrench-CuuxlWsQ.js","./assets/x-_RQtnv7w.js"];
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
